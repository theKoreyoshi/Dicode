import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { ApprovalRequest } from "@dicode/codex-adapter";
import {
  ApprovalManager,
  ProjectManager,
  SessionManager,
  TaskManager,
  TaskError,
  createDicodeCore,
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

  it("keeps a starting turn attached when a cross-provider resume is requested", async () => {
    const h = createHarness();
    const directory = mkdtempSync(join(tmpdir(), "dicode-core-provider-"));
    const core = createDicodeCore({ adapter: h.adapter, configDir: directory, dataDir: directory });
    const select = vi.fn().mockResolvedValue(undefined);
    h.adapter.selectCustomModel = select;
    let threadIndex = 0;
    h.adapter.createThread = async (options) => ({ id: `thread-${++threadIndex}`, model: options?.model });
    try {
      await core.initialize();
      const native = await core.createSession({ projectPath: directory });
      const customModel = { model: "fixture-model", baseUrl: "http://localhost:4040/v1" };
      core.saveCustomModel(customModel);
      const custom = await core.createSession({ projectPath: directory });
      expect(custom.customModel).toEqual(customModel);

      const starting = core.sendMessage(custom.id, { text: "Use the fixture model" });
      const resume = core.resumeSession(native.id);
      const resumeResult = expect(resume).rejects.toThrow(/active turns/);
      const active = await starting;
      await resumeResult;
      expect(select.mock.calls).toEqual([[customModel]]);
      expect(() => core.saveCustomModel(null)).toThrow(/active turns/);

      h.adapter.emitEvent({
        id: "fixture-end", type: "turn.completed", timestamp: Date.now(), sessionId: custom.codexThreadId,
        turnId: active.turnId ?? undefined, payload: { turn: { status: "completed" } },
      });
      core.saveCustomModel(null);
      await core.resumeSession(native.id);
      await core.resumeSession(custom.id);
      expect(select.mock.calls).toEqual([[customModel], [undefined], [customModel]]);
      expect(core.getSession(custom.id)?.customModel).toEqual(customModel);
    } finally {
      await core.shutdown();
      h.db.close();
      rmSync(directory, { recursive: true, force: true });
    }
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
    expect(h.repos.message.listBySession("s1").map((message) => message.content)).toEqual(["first", "more"]);
  });

  it("does not reopen a turn whose notifications complete before the start response", async () => {
    const h = createHarness();
    insertSession(h);
    const manager = new TaskManager(h.adapter, h.repos.session, h.repos.task, h.repos.message, h.state, h.events);
    const event = { id: "evt", sessionId: "thread-1", turnId: "turn-1", timestamp: Date.now() };
    h.adapter.startTurn = async () => {
      h.events.handleAdapterEvent({ ...event, type: "turn.started", payload: {} });
      h.events.handleAdapterEvent({ ...event, type: "shell.started", itemId: "tool-1", payload: { item: { type: "commandExecution", command: "npm test" } } });
      h.events.handleAdapterEvent({ ...event, type: "shell.completed", itemId: "tool-1", payload: { item: { type: "commandExecution", status: "failed", aggregatedOutput: "test failure" } } });
      h.events.handleAdapterEvent({ ...event, type: "agent.message.delta", itemId: "assistant-1", payload: { delta: "partial" } });
      h.events.handleAdapterEvent({ ...event, type: "turn.completed", payload: { turn: { status: "interrupted" } } });
      return { id: "turn-1", status: "inProgress" };
    };
    const task = await manager.sendMessage("s1", { text: "run tests" });
    expect(task.status).toBe("interrupted");
    expect(manager.getRunningTask("s1")).toBeNull();
    expect(h.repos.message.listBySession("s1")).toMatchObject([{ content: "run tests" }, { content: "partial", incomplete: true }]);
    expect(h.repos.tool.listBySession("s1")).toMatchObject([{ toolName: "npm test", status: "failed", output: "test failure" }]);
  });

  it("delivers an interrupt requested while the turn is still starting", async () => {
    const h = createHarness();
    insertSession(h);
    const manager = new TaskManager(h.adapter, h.repos.session, h.repos.task, h.repos.message, h.state, h.events);
    type Turn = Awaited<ReturnType<typeof h.adapter.startTurn>>;
    let resolveTurn!: (turn: Turn) => void;
    const turn = new Promise<Turn>((resolve) => { resolveTurn = resolve; });
    h.adapter.startTurn = () => turn;
    h.adapter.interruptTurn = vi.fn().mockResolvedValue(undefined);
    const pending = manager.sendMessage("s1", { text: "start" });
    await manager.interruptTask("s1");
    expect(h.adapter.interruptTurn).not.toHaveBeenCalled();
    resolveTurn({ id: "turn-1", status: "inProgress" });
    await pending;
    expect(h.adapter.interruptTurn).toHaveBeenCalledOnce();
    expect(h.adapter.interruptTurn).toHaveBeenCalledWith("thread-1");
  });

  it("recovers orphaned persisted tasks while preserving tasks owned by a live process", async () => {
    const h = createHarness();
    insertSession(h, "orphan");
    insertSession(h, "live");
    const manager = new TaskManager(h.adapter, h.repos.session, h.repos.task, h.repos.message, h.state, h.events);
    const active = await manager.sendMessage("live", { text: "running" });
    const orphan = { ...active, id: "orphan-task", sessionId: "orphan", turnId: "orphan-turn", ownerPid: null };
    h.repos.task.insert(orphan);
    expect(manager.recoverOrphanedTasks()).toEqual(new Set(["orphan"]));
    expect(manager.getTask(orphan.id)?.status).toBe("interrupted");
    expect(manager.getTask(active.id)?.status).toBe("running");
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

  it("releases the local approval state when the runtime closes its request", async () => {
    const h = createHarness();
    const directory = mkdtempSync(join(tmpdir(), "dicode-core-approval-"));
    const core = createDicodeCore({ adapter: h.adapter, configDir: directory, dataDir: directory });
    try {
      await core.initialize();
      const session = await core.createSession({ projectPath: directory });
      const task = await core.sendMessage(session.id, { text: "review" });
      const events = vi.fn();
      const off = core.subscribe(events);
      for (const id of [0, 1]) {
        for (const listener of h.adapter.approvalListeners) listener({
          id, threadId: session.codexThreadId, turnId: task.turnId ?? undefined,
          method: "item/tool/requestUserInput", type: "toolInput", params: {}, createdAt: Date.now(), pending: true,
        });
      }
      expect(core.getTask(task.id)?.status).toBe("waiting_approval");
      h.adapter.emitEvent({
        id: "evt", type: "approval.expired", sessionId: session.codexThreadId, timestamp: Date.now(), payload: { requestId: 0 },
      });
      expect(core.getTask(task.id)?.status).toBe("waiting_approval");
      expect(core.getPendingApprovals()).toMatchObject([{ codexRequestId: "1" }]);
      expect(events).toHaveBeenCalledWith(expect.objectContaining({
        type: "approval.resolved", sessionId: session.id, payload: expect.objectContaining({ status: "expired" }),
      }));
      await core.respondApproval(core.getPendingApprovals()[0].id, { kind: "custom", result: { action: "cancel" } });
      expect(core.getTask(task.id)?.status).toBe("running");
      expect(core.listApprovals(session.id)).toEqual(expect.arrayContaining([expect.objectContaining({ status: "cancelled" })]));
      off();
    } finally {
      await core.shutdown();
      h.db.close();
      rmSync(directory, { recursive: true, force: true });
    }
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
    h.events.handleAdapterEvent({ id: "e4", type: "item.completed", sessionId: "s1", turnId: "turn-1", itemId: "i1", timestamp: now, payload: { item: { type: "agentMessage", phase: "final_answer", text: "Hello world!" } } });
    expect(h.repos.message.listBySession("s1")).toMatchObject([{ content: "Hello world!", phase: "final_answer" }]);

    h.events.handleAdapterEvent({ id: "e5", type: "turn.completed", sessionId: "s1", turnId: "turn-1", timestamp: now, payload: { turn: { id: "turn-1", status: "completed" } } });
    expect(h.repos.task.get("task1")?.status).toBe("completed");
  });

  it("persists native plans and MCP progress with the same final result as the UI", () => {
    const h = createHarness();
    insertSession(h);
    const event = { id: "evt", sessionId: "thread-1", turnId: "turn-1", itemId: "mcp-1", timestamp: Date.now() };
    const item = { type: "mcpToolCall", server: "workspace", tool: "search" };
    const plan = { explanation: null, plan: [{ step: "Read sources", status: "inProgress" }] };
    h.events.handleAdapterEvent({ ...event, type: "plan.updated", payload: plan });
    h.events.handleAdapterEvent({ ...event, type: "item.completed", itemId: "plan-1", payload: { item: { type: "plan", text: "Read the project sources" } } });
    h.events.handleAdapterEvent({ ...event, type: "tool.started", payload: { item } });
    h.events.handleAdapterEvent({ ...event, type: "tool.output", payload: { delta: "Finding files\n" } });
    h.events.handleAdapterEvent({ ...event, type: "tool.completed", payload: { item: { ...item, status: "completed", result: {
      content: [{ type: "text", text: "Found index.ts" }, { type: "image", data: "large image payload" }],
    } } } });
    expect(h.repos.event.getLatestByType("s1", "plan.updated")?.payload).toEqual(plan);
    expect(h.repos.message.listBySession("s1")).toMatchObject([{ itemId: "plan-1", kind: "plan", content: "Read the project sources" }]);
    expect(h.repos.tool.listBySession("s1")).toMatchObject([{ toolName: "workspace/search", output: "Finding files\nFound index.ts\n[image]" }]);
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
