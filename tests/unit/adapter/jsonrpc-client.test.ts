import { describe, expect, it } from "vitest";
import { JsonRpcClient, type RpcTransport, type ServerRequest, type WireMessage } from "@dicode/codex-adapter";

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
