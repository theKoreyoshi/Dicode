import { describe, expect, it } from "vitest";
import { RequestManager, RpcResponseError, RpcTimeoutError } from "@dicode/codex-adapter";

describe("RequestManager", () => {
  it("resolves a pending request by id", async () => {
    const manager = new RequestManager();
    const { id, promise } = manager.create("model/list");
    expect(manager.pendingCount).toBe(1);
    manager.resolve(id, { data: [] });
    await expect(promise).resolves.toEqual({ data: [] });
    expect(manager.pendingCount).toBe(0);
  });

  it("rejects with an RPC error", async () => {
    const manager = new RequestManager();
    const { id, promise } = manager.create("thread/list");
    manager.rejectWithRpcError(id, -32000, "boom", { detail: 1 });
    await expect(promise).rejects.toBeInstanceOf(RpcResponseError);
  });

  it("rejects duplicate resolution attempts safely", async () => {
    const manager = new RequestManager();
    const { id, promise } = manager.create("thread/list");
    expect(manager.resolve(id, 1)).toBe(true);
    expect(manager.resolve(id, 2)).toBe(false);
    await expect(promise).resolves.toBe(1);
  });

  it("times out a pending request", async () => {
    const manager = new RequestManager();
    const { promise } = manager.create("turn/start", 10);
    await expect(promise).rejects.toBeInstanceOf(RpcTimeoutError);
    expect(manager.pendingCount).toBe(0);
  });

  it("fails all pending requests on disconnect", async () => {
    const manager = new RequestManager();
    const a = manager.create("model/list").promise;
    const b = manager.create("thread/list").promise;
    manager.failAll(new Error("connection closed"));
    await expect(a).rejects.toThrow("connection closed");
    await expect(b).rejects.toThrow("connection closed");
    expect(manager.pendingCount).toBe(0);
  });
});
