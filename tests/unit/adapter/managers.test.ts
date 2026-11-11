import { describe, expect, it, vi } from "vitest";
import {
  CodexApprovalManager,
  CodexThreadManager,
  CodexTurnManager,
  RpcResponseError,
  TurnError,
} from "@dicode/codex-adapter";

describe("CodexThreadManager", () => {
  it("starts a thread and maps the result", async () => {
    const request = vi.fn().mockResolvedValue({
      thread: { id: "th1" },
      cwd: "C:\\proj",
      model: "deepseek-v4-pro",
    });
    const manager = new CodexThreadManager(request);
    const info = await manager.start({ cwd: "C:\\proj" });
    expect(info.id).toBe("th1");
    expect(info.cwd).toBe("C:\\proj");
    expect(request).toHaveBeenCalledWith("thread/start", { cwd: "C:\\proj" });
  });

  it("uses the native sandbox and approval option when explicitly requested", async () => {
    const request = vi.fn().mockResolvedValue({ thread: { id: "th1" } });
    const manager = new CodexThreadManager(request);
    await manager.start({ sandbox: "read-only", approvalPolicy: "untrusted" });
    expect(request).toHaveBeenCalledWith("thread/start", { sandbox: "read-only", approvalPolicy: "untrusted" });
    await manager.resume("th1");
    expect(request).toHaveBeenCalledWith("thread/resume", { threadId: "th1", excludeTurns: true });
  });

  it("sets Dicode's assistant identity through the App Server thread instructions", async () => {
    const request = vi.fn().mockResolvedValue({ thread: { id: "th1" } });
    const manager = new CodexThreadManager(request);
    await manager.start({ developerInstructions: "You are Dicode." });
    expect(request).toHaveBeenCalledWith("thread/start", { developerInstructions: "You are Dicode." });
    await manager.resume("th1", { developerInstructions: "You are Dicode." });
    expect(request).toHaveBeenCalledWith("thread/resume", {
      threadId: "th1", excludeTurns: true, developerInstructions: "You are Dicode.",
    });
  });

  it("reports the effective provider and model instead of saved thread summary values", async () => {
    const request = vi.fn().mockResolvedValue({
      thread: { id: "th1", modelProvider: "saved-provider", model: "saved-model" },
      modelProvider: "runtime-provider",
      model: "runtime-model",
    });
    const manager = new CodexThreadManager(request);
    await expect(manager.resume("th1")).resolves.toMatchObject({
      modelProvider: "runtime-provider", model: "runtime-model",
    });
  });

  it("lists threads from the data array", async () => {
    const request = vi.fn().mockResolvedValue({ data: [{ id: "a", preview: "one" }, { id: "b", preview: "two" }] });
    const manager = new CodexThreadManager(request);
    const list = await manager.list({ limit: 2 });
    expect(list).toHaveLength(2);
    expect(list[1].preview).toBe("two");
  });

  it("archives a thread", async () => {
    const request = vi.fn().mockResolvedValue({});
    const manager = new CodexThreadManager(request);
    await manager.archive("th1");
    expect(request).toHaveBeenCalledWith("thread/archive", { threadId: "th1" });
  });
});

describe("CodexTurnManager", () => {
  it("starts a turn and tracks the active turn id", async () => {
    const request = vi.fn().mockResolvedValue({ turn: { id: "turn1", status: "inProgress" } });
    const manager = new CodexTurnManager(request);
    const turn = await manager.start("th1", { text: "hello" });
    expect(turn.id).toBe("turn1");
    expect(manager.getActiveTurnId("th1")).toBe("turn1");
  });

  it("passes a real Codex collaboration mode and avoids restoring a turn that already ended", async () => {
    const request = vi.fn(async () => {
      manager.noteTurnStarted("th1", "turn1");
      manager.noteTurnEnded("th1", "turn1");
      return { turn: { id: "turn1", status: "inProgress" } };
    });
    const manager = new CodexTurnManager(request);
    await manager.start("th1", { text: "plan a change", mode: "plan", model: "test-model", effort: "high" });
    expect(request).toHaveBeenCalledWith("turn/start", expect.objectContaining({
      collaborationMode: {
        mode: "plan",
        settings: { model: "test-model", reasoning_effort: "high", developer_instructions: null },
      },
    }));
    expect(manager.getActiveTurnId("th1")).toBeUndefined();
  });

  it("requests full access only when the user selects that permission mode", async () => {
    const request = vi.fn().mockResolvedValue({ turn: { id: "turn1", status: "inProgress" } });
    const manager = new CodexTurnManager(request);
    await manager.start("th1", { text: "run command", permissionMode: "full" });
    expect(request).toHaveBeenCalledWith("turn/start", expect.objectContaining({
      approvalPolicy: "never",
      sandboxPolicy: { type: "dangerFullAccess" },
    }));
  });

  it("steers using the tracked expectedTurnId", async () => {
    const request = vi.fn().mockResolvedValue({ turn: { id: "turn1", status: "inProgress" } });
    const manager = new CodexTurnManager(request);
    await manager.start("th1", { text: "hello" });
    await manager.steer("th1", { text: "more" });
    expect(request).toHaveBeenCalledWith("turn/steer", {
      threadId: "th1",
      expectedTurnId: "turn1",
      input: [{ type: "text", text: "more" }],
    });
  });

  it("interrupts using the tracked turn id", async () => {
    const request = vi.fn().mockResolvedValue({ turn: { id: "turn1", status: "inProgress" } });
    const manager = new CodexTurnManager(request);
    await manager.start("th1", { text: "hello" });
    await manager.interrupt("th1");
    expect(request).toHaveBeenCalledWith("turn/interrupt", { threadId: "th1", turnId: "turn1" });
  });

  it("retries the same turn when Codex acknowledges start before the turn is interruptible", async () => {
    const request = vi.fn()
      .mockResolvedValueOnce({ turn: { id: "turn1", status: "inProgress" } })
      .mockRejectedValueOnce(new RpcResponseError(-32600, "no active turn to interrupt"))
      .mockResolvedValueOnce({});
    const manager = new CodexTurnManager(request);
    await manager.start("th1", { text: "hello" });
    await manager.interrupt("th1");
    const expected = ["turn/interrupt", { threadId: "th1", turnId: "turn1" }];
    expect(request.mock.calls.slice(1)).toEqual([expected, expected]);
  });

  it("does not retry against a replacement turn or on an unrelated RPC error", async () => {
    const request = vi.fn();
    const manager = new CodexTurnManager(request);
    manager.noteTurnStarted("th1", "turn1");
    request.mockImplementationOnce(async () => {
      manager.noteTurnEnded("th1", "turn1");
      manager.noteTurnStarted("th1", "turn2");
      throw new RpcResponseError(-32600, "no active turn to interrupt");
    });
    await manager.interrupt("th1");
    expect(request).toHaveBeenCalledOnce();
    request.mockRejectedValueOnce(new RpcResponseError(-32602, "invalid thread id"));
    await expect(manager.interrupt("th1")).rejects.toThrow("invalid thread id");
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("throws when steering without an active turn", async () => {
    const manager = new CodexTurnManager(vi.fn());
    await expect(manager.steer("th1", { text: "x" })).rejects.toBeInstanceOf(TurnError);
  });
});

describe("CodexApprovalManager", () => {
  it("tracks and approves a command approval", async () => {
    const respond = vi.fn();
    const manager = new CodexApprovalManager(respond);
    const handled = manager.handleServerRequest("req-1", "item/commandExecution/requestApproval", {
      threadId: "t1",
      turnId: "turn1",
      itemId: "i1",
      command: "npm test",
    });
    expect(handled).toBe(true);
    expect(manager.getPendingApprovals()).toHaveLength(1);

    await manager.respond("req-1", { kind: "approve" });
    expect(respond).toHaveBeenCalledWith("req-1", { decision: "accept" });
    expect(manager.getPendingApprovals()).toHaveLength(0);
  });

  it("denies a file change approval", async () => {
    const respond = vi.fn();
    const manager = new CodexApprovalManager(respond);
    manager.handleServerRequest("req-2", "item/fileChange/requestApproval", { itemId: "i2" });
    await manager.reject("req-2");
    expect(respond).toHaveBeenCalledWith("req-2", { decision: "decline" });
  });

  it("refuses to respond twice", async () => {
    const respond = vi.fn();
    const manager = new CodexApprovalManager(respond);
    manager.handleServerRequest("req-3", "item/commandExecution/requestApproval", {});
    await manager.respond("req-3", { kind: "deny" });
    await expect(manager.respond("req-3", { kind: "approve" })).rejects.toThrow(/already resolved/);
  });

  it("ignores non-approval server requests", () => {
    const manager = new CodexApprovalManager(vi.fn());
    expect(manager.handleServerRequest("r", "currentTime/read", {})).toBe(false);
  });
});
