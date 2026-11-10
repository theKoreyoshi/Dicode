import { describe, expect, it } from "vitest";
import type { CoreEvent } from "@dicode/core";
import { createInitialUiState, mergeStreamingDeltas, uiReducer, type UiState } from "@dicode/tui";

function receive(state: UiState, type: CoreEvent["type"], payload: unknown = {}, fields: Partial<CoreEvent> = {}) {
  return uiReducer(state, {
    type: "CORE_EVENT",
    event: { id: "e1", type, sequence: 1, timestamp: 100, sessionId: "active", payload, ...fields },
  });
}

const active = () => uiReducer(createInitialUiState(), { type: "SET_SESSION", sessionId: "active" });

describe("uiReducer", () => {
  it("sets a running status and waits for a real assistant item", () => {
    const state = receive(active(), "task.started", {}, { taskId: "task-1" });
    expect(state.status).toBe("running");
    expect(state.currentTaskId).toBe("task-1");
    expect(state.messages).toEqual([]);
  });

  it("streams separate assistant items and reconciles each final payload", () => {
    let state = receive(active(), "message.started", { item: { type: "agentMessage", phase: "commentary" } }, { itemId: "first" });
    state = receive(state, "message.delta", { delta: "hello " }, { itemId: "first" });
    state = receive(state, "message.delta", { delta: "world" }, { itemId: "first" });
    state = receive(state, "message.completed", { item: { type: "agentMessage", phase: "final_answer", text: "Hello world!" } }, { itemId: "first" });
    state = receive(state, "message.delta", { delta: "late duplicate" }, { itemId: "first" });
    state = receive(state, "message.delta", { delta: "second item" }, { itemId: "second" });
    expect(state.messages).toMatchObject([
      { id: "first", phase: "final_answer", content: "Hello world!", streaming: false },
      { id: "second", content: "second item", streaming: true },
    ]);
  });

  it("finalizes partial messages on interruption", () => {
    let state = receive(active(), "task.started", {}, { taskId: "task-1" });
    state = receive(state, "message.delta", { delta: "partial" }, { itemId: "first", taskId: "task-1" });
    state = receive(state, "task.interrupted", {}, { taskId: "task-1" });
    expect(state.status).toBe("ready");
    expect(state.messages).toMatchObject([{ content: "partial", streaming: false, incomplete: true }]);
  });

  it("keeps approvals scoped to the active session and until every request is resolved", () => {
    let state = receive(active(), "task.started", {}, { taskId: "task-1" });
    expect(receive(state, "approval.requested", { id: "other" }, { sessionId: "other" })).toBe(state);
    state = receive(state, "approval.requested", { id: "a1", status: "pending" });
    state = receive(state, "approval.requested", { id: "a2", status: "pending" });
    expect(state.status).toBe("waiting_approval");
    state = receive(state, "approval.resolved", { id: "a1", status: "approved" });
    expect(state.status).toBe("waiting_approval");
    expect(state.pendingApprovals).toHaveLength(1);
    state = receive(state, "approval.resolved", { id: "a2", status: "approved" });
    expect(state.status).toBe("running");
    expect(state.pendingApprovals).toHaveLength(0);
  });

  it("keeps tool output attached to the matching item and applies the final result", () => {
    let state = receive(active(), "tool.started", { item: { type: "commandExecution", command: "npm test" } }, { itemId: "shell" });
    state = receive(state, "tool.output", { delta: "checking" }, { itemId: "shell", timestamp: 120 });
    expect(state.tools[0]).toMatchObject({ label: "npm test", status: "running", output: "checking" });
    state = receive(state, "tool.completed", { item: { aggregatedOutput: "failed output", exitCode: 1 } }, { itemId: "shell", timestamp: 150 });
    expect(state.tools).toMatchObject([{ id: "shell", timestamp: 100, status: "failed", output: "failed output", exitCode: 1 }]);
  });

  it("drops failed submissions without a Codex turn and clears stale approvals on completion", () => {
    let state = receive(active(), "task.created", {}, { taskId: "task-1" });
    state = receive(state, "message.submitted", { id: "m1", role: "user", content: "retry", taskId: "task-1", createdAt: 100 });
    state = receive(state, "approval.requested", { id: "approval-1" });
    state = receive(state, "task.failed", { error: "request rejected" }, { taskId: "task-1" });
    expect(state.error).toBe("request rejected");
    expect(state.messages).toEqual([]);
    expect(state.pendingApprovals).toEqual([]);
  });
});

describe("mergeStreamingDeltas", () => {
  it("concatenates deltas in order", () => {
    expect(mergeStreamingDeltas(["a", "b", "c"])).toBe("abc");
  });
});
