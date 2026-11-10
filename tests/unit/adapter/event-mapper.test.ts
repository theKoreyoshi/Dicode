import { describe, expect, it } from "vitest";
import { mapNotification } from "@dicode/codex-adapter";

describe("mapNotification", () => {
  it("maps turn lifecycle", () => {
    const started = mapNotification({
      method: "turn/started",
      params: { threadId: "t1", turn: { id: "turn1", status: "inProgress" } },
    });
    expect(started.type).toBe("turn.started");
    expect(started.turnId).toBe("turn1");

    const completed = mapNotification({ method: "turn/completed", params: { threadId: "t1", turn: { id: "turn1" } } });
    expect(completed.type).toBe("turn.completed");
  });

  it("maps agent message deltas", () => {
    const event = mapNotification({
      method: "item/agentMessage/delta",
      params: { threadId: "t1", turnId: "turn1", itemId: "item1", delta: "hello" },
    });
    expect(event.type).toBe("agent.message.delta");
    expect(event.itemId).toBe("item1");
  });

  it("classifies a command execution item as a shell event", () => {
    const event = mapNotification({
      method: "item/started",
      params: { threadId: "t1", turnId: "turn1", item: { id: "i1", type: "commandExecution" } },
    });
    expect(event.type).toBe("shell.started");
  });

  it("classifies a function call item as a tool event", () => {
    const event = mapNotification({
      method: "item/completed",
      params: { threadId: "t1", turnId: "turn1", item: { id: "i1", type: "functionCall" } },
    });
    expect(event.type).toBe("tool.completed");
  });

  it("maps file change output deltas", () => {
    const event = mapNotification({
      method: "item/fileChange/outputDelta",
      params: { threadId: "t1", turnId: "turn1", itemId: "i1", delta: "patch output" },
    });
    expect(event).toMatchObject({ type: "tool.output", itemId: "i1", payload: { delta: "patch output" } });
  });

  it("maps pinned Codex plan steps and MCP progress notifications", () => {
    const plan = { threadId: "t1", turnId: "turn1", explanation: null, plan: [{ step: "Read sources", status: "inProgress" }] };
    expect(mapNotification({ method: "turn/plan/updated", params: plan })).toMatchObject({ type: "plan.updated", payload: plan });
    expect(mapNotification({
      method: "item/plan/delta",
      params: { threadId: "t1", turnId: "turn1", itemId: "plan1", delta: "First step" },
    })).toMatchObject({ type: "agent.message.delta", itemId: "plan1", payload: { delta: "First step" } });
    expect(mapNotification({
      method: "item/mcpToolCall/progress",
      params: { threadId: "t1", turnId: "turn1", itemId: "i1", message: "Found file" },
    })).toMatchObject({ type: "tool.output", itemId: "i1", payload: { delta: "Found file\n" } });
  });

  it("maps unknown methods to an unknown event without throwing", () => {
    const event = mapNotification({ method: "some/future/method", params: { x: 1 } });
    expect(event.type).toBe("unknown");
  });
});
