import { describe, expect, it, vi } from "vitest";
import { JsonRpcClient, resolveProcessConfig, type RpcTransport, type ServerRequest, type WireMessage } from "@dicode/codex-adapter";
import { loginWithBrowser } from "../../../packages/codex-adapter/src/client/account.js";

class MockTransport implements RpcTransport {
  written: WireMessage[] = [];
  private messageHandler: ((m: WireMessage) => void) | null = null;
  private errorHandler: ((e: Error) => void) | null = null;

  write(message: WireMessage): void {
    this.written.push(message);
  }

  onMessage(handler: (m: WireMessage) => void): () => void {
    this.messageHandler = handler;
    return () => {
      this.messageHandler = null;
    };
  }

  onError(handler: (e: Error) => void): () => void {
    this.errorHandler = handler;
    return () => {
      this.errorHandler = null;
    };
  }

  close(): void {}

  deliver(message: WireMessage): void {
    this.messageHandler?.(message);
  }

  fail(error: Error): void {
    this.errorHandler?.(error);
  }
}

describe("JsonRpcClient", () => {
  it("correlates a response to its request", async () => {
    const transport = new MockTransport();
    const client = new JsonRpcClient({ transport });
    const promise = client.request("model/list", { limit: 1 });

    const sent = transport.written[0];
    expect(sent.method).toBe("model/list");
    expect(typeof sent.id).toBe("string");

    transport.deliver({ id: sent.id, result: { data: [] } });
    await expect(promise).resolves.toEqual({ data: [] });
  });

  it("rejects on an error response", async () => {
    const transport = new MockTransport();
    const client = new JsonRpcClient({ transport });
    const promise = client.request("thread/list");
    const sent = transport.written[0];
    transport.deliver({ id: sent.id, error: { code: -32000, message: "nope" } });
    await expect(promise).rejects.toMatchObject({ rpcCode: -32000 });
  });

  it("dispatches notifications", () => {
    const transport = new MockTransport();
    const client = new JsonRpcClient({ transport });
    const seen: string[] = [];
    client.onNotification((method) => seen.push(method));
    transport.deliver({ method: "turn/completed", params: {} });
    expect(seen).toEqual(["turn/completed"]);
  });

  it("routes browser login by ID without replacing the normal event listener", async () => {
    const transport = new MockTransport();
    const client = new JsonRpcClient({ transport });
    const events = vi.fn();
    const showUrl = vi.fn();
    client.onNotification(events);
    const login = loginWithBrowser(client, showUrl, new AbortController().signal);
    const sent = transport.written[0];
    expect(sent).toMatchObject({ method: "account/login/start", params: { type: "chatgpt" } });
    transport.deliver({ id: sent.id, result: { type: "chatgpt", loginId: "browser-login", authUrl: "https://auth.openai.com/" } });
    await vi.waitFor(() => expect(showUrl).toHaveBeenCalledWith("https://auth.openai.com/"));
    transport.deliver({ method: "account/login/completed", params: { loginId: "other", success: false } });
    transport.deliver({ method: "account/login/completed", params: { loginId: "browser-login", success: true } });
    await expect(login).resolves.toBeUndefined();
    expect(events).toHaveBeenCalledTimes(2);
  });

  it("cancels an abandoned browser login in the runtime", async () => {
    const transport = new MockTransport();
    const client = new JsonRpcClient({ transport });
    const controller = new AbortController();
    const showUrl = vi.fn();
    const login = loginWithBrowser(client, showUrl, controller.signal);
    transport.deliver({ id: transport.written[0].id, result: {
      type: "chatgpt", loginId: "browser-login", authUrl: "https://auth.openai.com/",
    } });
    await vi.waitFor(() => expect(showUrl).toHaveBeenCalledTimes(1));
    controller.abort(new Error("cancelled by user"));
    await vi.waitFor(() => expect(transport.written).toHaveLength(2));
    const cancel = transport.written[1];
    expect(cancel).toMatchObject({ method: "account/login/cancel", params: { loginId: "browser-login" } });
    transport.deliver({ id: cancel.id, result: { status: "canceled" } });
    await expect(login).rejects.toThrow("cancelled by user");
  });

  it("cancels browser login even before Codex replies with a URL", async () => {
    const transport = new MockTransport();
    const client = new JsonRpcClient({ transport });
    const controller = new AbortController();
    const showUrl = vi.fn();
    const login = loginWithBrowser(client, showUrl, controller.signal);
    try {
      controller.abort(new Error("cancelled before startup"));
      await expect(login).rejects.toThrow("cancelled before startup");
      expect(showUrl).not.toHaveBeenCalled();
      expect(transport.written.map((request) => request.method)).toEqual(["account/login/start"]);
    } finally {
      client.close();
    }
  });

  it("routes server requests to the handler", () => {
    const transport = new MockTransport();
    const client = new JsonRpcClient({ transport });
    const received: ServerRequest[] = [];
    client.onServerRequest((request) => {
      received.push(request);
      client.respond(request.id, { decision: "accept" });
    });
    transport.deliver({ id: "srv-1", method: "item/commandExecution/requestApproval", params: { command: "ls" } });

    expect(received[0].method).toBe("item/commandExecution/requestApproval");
    expect(transport.written.some((m) => m.id === "srv-1" && (m as { result?: unknown }).result !== undefined)).toBe(true);
  });

  it("responds with method-not-found for unhandled server requests", () => {
    const transport = new MockTransport();
    const client = new JsonRpcClient({ transport });
    transport.deliver({ id: 9, method: "unknown/method", params: {} });
    expect(client.pendingCount).toBe(0);
    const response = transport.written.find((m) => m.id === 9);
    expect(response?.error).toMatchObject({ code: -32601 });
  });
});

it("preserves separate user and Codex directories in the child environment", () => {
  const config = resolveProcessConfig({
    executablePath: process.execPath,
    env: { HOME: "user-directory", CODEX_HOME: "codex-directory" },
  });
  expect(config.env).toMatchObject({ HOME: "user-directory", CODEX_HOME: "codex-directory" });
});
