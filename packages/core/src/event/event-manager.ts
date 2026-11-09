import type { DicodeEvent } from "@dicode/codex-adapter";
import type { EventRecord, MessageRecord, ToolExecutionRecord } from "../storage/storage-types.js";
import type { EventRepository, MessageRepository, SessionRepository, TaskRepository, ToolExecutionRepository } from "../storage/repositories.js";
import type { StateManager } from "../state/state-manager.js";
import { createId } from "../utils/id.js";
import { nowMs } from "../utils/time.js";
import type { CoreEvent, CoreEventType } from "./event-types.js";

export type CoreEventListener = (event: CoreEvent) => void;

export interface EventManagerDeps {
  stateManager: StateManager;
  sessionRepo: SessionRepository;
  taskRepo: TaskRepository;
  messageRepo: MessageRepository;
  eventRepo: EventRepository;
  toolRepo: ToolExecutionRepository;
}

interface TurnRef {
  sessionId: string;
  taskId: string;
}

/**
 * Converts adapter events into Core events, assigns per-session sequence
 * numbers, updates session/task state, accumulates agent message deltas, and
 * persists key lifecycle events.
 */
export class EventManager {
  private readonly deps: EventManagerDeps;
  private readonly listeners = new Set<CoreEventListener>();
  private readonly turnIndex = new Map<string, TurnRef>();
  private readonly agentBuffers = new Map<string, string>();
  private readonly sequences = new Map<string, number>();

  constructor(deps: EventManagerDeps) {
    this.deps = deps;
  }

  subscribe(listener: CoreEventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  registerTurn(turnId: string, sessionId: string, taskId: string): void {
    this.turnIndex.set(turnId, { sessionId, taskId });
  }

  /** Emit a Dicode-level event directly (session/task/project lifecycle). */
  emit(type: CoreEventType, fields: Omit<CoreEvent, "id" | "type" | "sequence" | "timestamp">): void {
    const sequence = this.nextSequence(fields.sessionId);
    const event: CoreEvent = {
      id: createId("evt"),
      type,
      sequence,
      timestamp: nowMs(),
      ...fields,
    };
    this.persistEvent(event);
    this.dispatch(event);
  }

  handleAdapterEvent(adapterEvent: DicodeEvent): void {
    const mapped = this.mapAdapterEvent(adapterEvent);
    if (!mapped) return;

    const event = mapped as CoreEvent;
    this.persistEvent(event);
    this.dispatch(event);
  }

  private mapAdapterEvent(adapterEvent: DicodeEvent): CoreEvent | null {
    const ref = adapterEvent.turnId ? this.turnIndex.get(adapterEvent.turnId) : undefined;
    const sessionId = ref?.sessionId ?? adapterEvent.sessionId;
    const taskId = ref?.taskId;
    const sequence = this.nextSequence(sessionId);

    const base = {
      id: createId("evt"),
      sessionId,
      taskId,
      turnId: adapterEvent.turnId,
      itemId: adapterEvent.itemId,
      sequence,
      timestamp: nowMs(),
    };

    const payload = adapterEvent.payload as Record<string, unknown>;

    switch (adapterEvent.type) {
      case "turn.started":
        this.markTaskRunning(ref, sessionId);
        return { ...base, type: "task.started", payload };

      case "turn.completed": {
        const status = (payload.turn as { status?: string } | undefined)?.status;
        const coreType = status === "interrupted" ? "task.interrupted" : status === "failed" ? "task.failed" : "task.completed";
        this.markTaskEnded(ref, sessionId, coreType, status);
        return { ...base, type: coreType, payload };
      }

      case "agent.message.delta":
        this.appendAgentDelta(adapterEvent.itemId, payload.delta);
        return { ...base, type: "message.delta", payload };

      case "reasoning.delta":
        return { ...base, type: "message.delta", payload };

      case "item.started":
        if (isAgentItem(payload)) this.markMessageStarted(adapterEvent.itemId);
        return { ...base, type: "message.started", payload };

      case "item.completed":
        if (isAgentItem(payload)) this.flushAgentMessage(sessionId, taskId, adapterEvent.turnId, adapterEvent.itemId);
        return { ...base, type: "message.completed", payload };

      case "tool.started":
      case "shell.started":
        this.recordToolStarted(adapterEvent, payload);
        return { ...base, type: "tool.started", payload };

      case "shell.output":
        return { ...base, type: "tool.output", payload };

      case "tool.completed":
      case "shell.completed":
        this.recordToolCompleted(adapterEvent, payload);
        return { ...base, type: "tool.completed", payload };

      case "file.changed":
        return { ...base, type: "file.changed", payload };

      case "diff.updated":
        return { ...base, type: "diff.updated", payload };

      case "approval.requested":
        // Approval records are owned by the Core ApprovalManager, which also
        // transitions task/session state; do not double-emit here.
        return null;

      case "approval.resolved":
        return null;

      case "agent.error":
        return { ...base, type: "core.error", payload };

      case "connection.status":
        return { ...base, type: "runtime.connected", payload };

      default:
        return null; // unknown/irrelevant adapter events are dropped, not treated as errors
    }
  }

  private nextSequence(sessionId?: string): number {
    if (!sessionId) return 0;
    const next = (this.sequences.get(sessionId) ?? 0) + 1;
    this.sequences.set(sessionId, next);
    return next;
  }

  private dispatch(event: CoreEvent): void {
    for (const listener of [...this.listeners]) {
      try {
        listener(event);
      } catch {
        // A failing subscriber must not break event delivery.
      }
    }
  }

  private persistEvent(event: CoreEvent): void {
    if (!event.sessionId) return;
    const record: EventRecord = {
      id: event.id,
      sessionId: event.sessionId,
      taskId: event.taskId ?? null,
      turnId: event.turnId ?? null,
      itemId: event.itemId ?? null,
      type: event.type,
      payload: (event.payload as Record<string, unknown>) ?? {},
      sequence: event.sequence,
      createdAt: event.timestamp,
    };
    try {
      this.deps.eventRepo.insert(record);
    } catch {
      // Persistence is best-effort for high-frequency events.
    }
  }

  private appendAgentDelta(itemId: string | undefined, delta: unknown): void {
    if (!itemId || typeof delta !== "string") return;
    this.agentBuffers.set(itemId, (this.agentBuffers.get(itemId) ?? "") + delta);
  }

  private flushAgentMessage(sessionId: string | undefined, taskId: string | undefined, turnId: string | undefined, itemId: string | undefined): void {
    if (!sessionId || !itemId) return;
    const content = this.agentBuffers.get(itemId);
    if (!content) return;
    this.agentBuffers.delete(itemId);
    const record: MessageRecord = {
      id: createId("msg"),
      sessionId,
      taskId: taskId ?? null,
      turnId: turnId ?? null,
      itemId,
      role: "assistant",
      content,
      sequence: this.nextSequence(sessionId),
      createdAt: nowMs(),
    };
    try {
      this.deps.messageRepo.insert(record);
    } catch {
      // ignore
    }
  }

  private markMessageStarted(_itemId: string | undefined): void {
    // No-op hook; keeps agent buffer lifecycle explicit.
  }

  private recordToolStarted(event: DicodeEvent, payload: Record<string, unknown>): void {
    if (!event.sessionId) return;
    const item = payload.item as Record<string, unknown> | undefined;
    const record: ToolExecutionRecord = {
      id: createId("tool"),
      sessionId: event.sessionId,
      taskId: this.turnIndex.get(event.turnId ?? "")?.taskId ?? null,
      turnId: event.turnId ?? null,
      itemId: event.itemId ?? null,
      toolName: stringOr((item as Record<string, unknown> | undefined)?.name, stringOr(item?.type, "tool")),
      toolType: stringOr(item?.type, "tool"),
      status: "running",
      input: (item?.arguments as Record<string, unknown>) ?? {},
      output: null,
      durationMs: null,
      createdAt: nowMs(),
    };
    try {
      this.deps.toolRepo.insert(record);
    } catch {
      // ignore
    }
  }

  private recordToolCompleted(event: DicodeEvent, _payload: Record<string, unknown>): void {
    if (!event.itemId) return;
    const existing = this.deps.toolRepo.getByItemId(event.itemId);
    if (!existing) return;
    existing.status = "completed";
    existing.durationMs = nowMs() - existing.createdAt;
    try {
      this.deps.toolRepo.update(existing);
    } catch {
      // ignore
    }
  }

  private markTaskRunning(ref: TurnRef | undefined, sessionId: string | undefined): void {
    if (!ref || !sessionId) return;
    const task = this.deps.taskRepo.get(ref.taskId);
    if (task && (task.status === "queued" || task.status === "waiting_approval")) {
      task.status = "running";
      task.startedAt = task.startedAt ?? nowMs();
      this.deps.taskRepo.update(task);
      this.deps.stateManager.update((s) => {
        if (s.tasks.tasks[task.id]) s.tasks.tasks[task.id] = task;
        if (s.sessions.sessions[sessionId]) s.sessions.sessions[sessionId].status = "running";
      });
    }
  }

  private markTaskWaiting(ref: TurnRef | undefined, sessionId: string | undefined): void {
    if (!ref || !sessionId) return;
    const task = this.deps.taskRepo.get(ref.taskId);
    if (task && task.status === "running") {
      task.status = "waiting_approval";
      this.deps.taskRepo.update(task);
      this.deps.stateManager.update((s) => {
        if (s.tasks.tasks[task.id]) s.tasks.tasks[task.id] = task;
        if (s.sessions.sessions[sessionId]) s.sessions.sessions[sessionId].status = "waiting_approval";
      });
    }
  }

  getTurnRef(turnId: string): TurnRef | undefined {
    return this.turnIndex.get(turnId);
  }

  markTaskWaitingByTurn(turnId: string): void {
    const ref = this.turnIndex.get(turnId);
    if (ref) this.markTaskWaiting(ref, ref.sessionId);
  }

  private markTaskEnded(ref: TurnRef | undefined, sessionId: string | undefined, coreType: CoreEventType, status: string | undefined): void {
    if (!ref || !sessionId) return;
    const task = this.deps.taskRepo.get(ref.taskId);
    if (!task) return;
    const taskStatus = coreType === "task.completed" ? "completed" : coreType === "task.interrupted" ? "interrupted" : "failed";
    task.status = taskStatus;
    task.completedAt = nowMs();
    task.durationMs = task.completedAt - (task.startedAt ?? task.createdAt);
    if (taskStatus === "failed") task.error = status ?? "failed";
    this.deps.taskRepo.update(task);
    this.deps.stateManager.update((s) => {
      if (s.tasks.tasks[task.id]) s.tasks.tasks[task.id] = task;
      delete s.tasks.runningBySession[sessionId];
      const session = s.sessions.sessions[sessionId];
      if (session) session.status = taskStatus === "failed" ? "failed" : taskStatus === "interrupted" ? "interrupted" : "completed";
    });
  }
}

function isAgentItem(payload: Record<string, unknown>): boolean {
  const item = payload.item as Record<string, unknown> | undefined;
  return item?.type === "agentMessage";
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}
