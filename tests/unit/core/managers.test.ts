import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ApprovalRequest } from "@dicode/codex-adapter";
import {
  ApprovalManager,
  ProjectManager,
  SessionManager,
  TaskManager,
  TaskError,
  deriveTitle,
} from "@dicode/core";
import { createHarness } from "./helpers.js";

function insertSession(harness: ReturnType<typeof createHarness>, id = "s1"): void {
  const now = Date.now();
  harness.repos.session.insert({
    id,
    codexThreadId: "thread-1",
    projectPath: "C:/proj",
    title: "",
    cwd: "C:/proj",
    model: null,
    status: "idle",
    createdAt: now,
    updatedAt: now,
    lastActivityAt: now,
    archived: false,
    metadata: {},
  });
}

describe("SessionManager", () => {
  it("creates a session backed by a codex thread", async () => {
    const h = createHarness();
    const manager = new SessionManager(h.adapter, h.repos.session, h.state, h.events);
    const session = await manager.create({ projectPath: "C:/proj" });
    expect(session.codexThreadId).toBe("thread-1");
    expect(h.repos.session.get(session.id)?.status).toBe("idle");
  });

  it("derives a title from user text", () => {
    expect(deriveTitle("  hello   world \n again ", 10)).toBe("hello worl…");
  });

  it("archives a session", async () => {
    const h = createHarness();
    insertSession(h);
    const manager = new SessionManager(h.adapter, h.repos.session, h.state, h.events);
    await manager.archive("s1");
    expect(h.repos.session.get("s1")?.archived).toBe(true);
  });
});

describe("TaskManager", () => {
  it("sends a message, creating a task and user message", async () => {
    const h = createHarness();
    insertSession(h);
    const manager = new TaskManager(h.adapter, h.repos.session, h.repos.task, h.repos.message, h.state, h.events);
    const task = await manager.sendMessage("s1", { text: "hello world" });
    expect(task.turnId).toBe("turn-1");
    expect(task.status).toBe("running");
    expect(h.repos.message.listBySession("s1")).toHaveLength(1);
    expect(h.repos.session.get("s1")?.title).toBe("hello world");
  });

  it("enforces a session-level concurrency lock", async () => {
    const h = createHarness();
    insertSession(h);
    const manager = new TaskManager(h.adapter, h.repos.session, h.repos.task, h.repos.message, h.state, h.events);
    await manager.sendMessage("s1", { text: "first" });
    await expect(manager.sendMessage("s1", { text: "second" })).rejects.toBeInstanceOf(TaskError);
  });

  it("steers and interrupts delegate to the adapter", async () => {
    const h = createHarness();
    insertSession(h);
    const manager = new TaskManager(h.adapter, h.repos.session, h.repos.task, h.repos.message, h.state, h.events);
    await manager.sendMessage("s1", { text: "first" });
    await manager.steerTask("s1", { text: "more" });
    await manager.interruptTask("s1");
  });
});

describe("ApprovalManager", () => {
  it("persists a request and resolves it exactly once", async () => {
    const h = createHarness();
    insertSession(h);
    const manager = new ApprovalManager(
      h.adapter.approvalManager,
      h.repos.approval,
      h.repos.task,
      h.state,
      h.events,
      { resolve: () => ({ sessionId: "s1" }) },
    );
    const request: ApprovalRequest = {
      id: "req-1",
      method: "item/commandExecution/requestApproval",
      type: "command",
      threadId: "thread-1",
      params: { command: "npm test" },
      createdAt: Date.now(),
      pending: true,
    };
    const record = manager.handleRequest(request);
    expect(record.status).toBe("pending");
    await manager.respond(record.id, { kind: "approve" });
    expect(manager.getPending()).toHaveLength(0);
    await expect(manager.respond(record.id, { kind: "deny" })).rejects.toThrow(/already resolved/);
  });
});

describe("EventManager", () => {
  it("maps turn lifecycle to task state and accumulates agent text", () => {
    const h = createHarness();
    insertSession(h);
    const now = Date.now();
    h.repos.task.insert({ id: "task1", sessionId: "s1", turnId: "turn-1", status: "queued", inputText: "hi", error: null, createdAt: now, startedAt: null, completedAt: null, durationMs: null });
    h.events.registerTurn("turn-1", "s1", "task1");

    h.events.handleAdapterEvent({ id: "e1", type: "turn.started", sessionId: "s1", turnId: "turn-1", timestamp: now, payload: {} });
    expect(h.repos.task.get("task1")?.status).toBe("running");

    h.events.handleAdapterEvent({ id: "e2", type: "agent.message.delta", sessionId: "s1", turnId: "turn-1", itemId: "i1", timestamp: now, payload: { delta: "hello " } });
    h.events.handleAdapterEvent({ id: "e3", type: "agent.message.delta", sessionId: "s1", turnId: "turn-1", itemId: "i1", timestamp: now, payload: { delta: "world" } });
    h.events.handleAdapterEvent({ id: "e4", type: "item.completed", sessionId: "s1", turnId: "turn-1", itemId: "i1", timestamp: now, payload: { item: { type: "agentMessage" } } });
    expect(h.repos.message.listBySession("s1").map((m) => m.content)).toContain("hello world");

    h.events.handleAdapterEvent({ id: "e5", type: "turn.completed", sessionId: "s1", turnId: "turn-1", timestamp: now, payload: { turn: { id: "turn-1", status: "completed" } } });
    expect(h.repos.task.get("task1")?.status).toBe("completed");
  });
});

describe("ProjectManager", () => {
  it("opens a directory and records non-git status", () => {
    const h = createHarness();
    const dir = mkdtempSync(join(tmpdir(), "dicode-proj-"));
    const manager = new ProjectManager(h.repos.project, h.state, h.events);
    const project = manager.open(dir);
    expect(project.path).toBe(dir);
    expect(project.isGitRepository).toBe(false);
  });
});
