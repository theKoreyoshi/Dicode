import { describe, expect, it } from "vitest";
import { createInitialUiState, mergeStreamingDeltas, uiReducer } from "@dicode/tui";

function event(type: string, payload: unknown = {}) {
  return { id: "e1", type, sequence: 1, timestamp: Date.now(), payload } as never;
}

describe("uiReducer", () => {
  it("adds a streaming message on task.started", () => {
    const state = uiReducer(createInitialUiState(), { type: "CORE_EVENT", event: event("task.started", {}) });
    expect(state.status).toBe("running");
    expect(state.messages.some((m) => m.streaming)).toBe(true);
  });

  it("appends message deltas to the streaming message", () => {
    let state = uiReducer(createInitialUiState(), { type: "CORE_EVENT", event: event("task.started") });
    state = uiReducer(state, { type: "CORE_EVENT", event: event("message.delta", { delta: "hello " }) });
    state = uiReducer(state, { type: "CORE_EVENT", event: event("message.delta", { delta: "world" }) });
    const streaming = state.messages.find((m) => m.streaming);
    expect(streaming?.content).toBe("hello world");
  });

  it("finalizes streaming on task.completed", () => {
    let state = uiReducer(createInitialUiState(), { type: "CORE_EVENT", event: event("task.started") });
    state = uiReducer(state, { type: "CORE_EVENT", event: event("task.completed") });
    expect(state.status).toBe("ready");
    expect(state.messages.every((m) => !m.streaming)).toBe(true);
  });

  it("adds an approval and opens the modal", () => {
    const state = uiReducer(createInitialUiState(), {
      type: "CORE_EVENT",
      event: event("approval.requested", { id: "a1", status: "pending" }),
    });
    expect(state.status).toBe("waiting_approval");
    expect(state.approvalModalOpen).toBe(true);
    expect(state.pendingApprovals).toHaveLength(1);
  });

  it("removes a resolved approval", () => {
    let state = uiReducer(createInitialUiState(), {
      type: "CORE_EVENT",
      event: event("approval.requested", { id: "a1", status: "pending" }),
    });
    state = uiReducer(state, {
      type: "CORE_EVENT",
      event: event("approval.resolved", { id: "a1", status: "approved" }),
    });
    expect(state.pendingApprovals).toHaveLength(0);
    expect(state.approvalModalOpen).toBe(false);
  });
});

describe("mergeStreamingDeltas", () => {
  it("concatenates deltas in order", () => {
    expect(mergeStreamingDeltas(["a", "b", "c"])).toBe("abc");
  });
});
