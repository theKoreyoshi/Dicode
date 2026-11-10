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

interface AgentBuffer {
  sessionId: string;
  taskId: string | null;
  turnId: string | null;
  content: string;
  startedAt: number;
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
  private readonly agentBuffers = new Map<string, AgentBuffer>();
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

  endTask(sessionId: string, taskId: string, status: "completed" | "failed" | "interrupted", error?: string): void {
    const type = `task.${status}` as const;
    const task = this.markTaskEnded({ sessionId, taskId }, sessionId, type, { turn: { error: { message: error } } });
    if (task) this.emit(type, { sessionId, taskId, turnId: task.turnId ?? undefined, payload: task });
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
    const knownTurn = adapterEvent.turnId ? this.turnIndex.get(adapterEvent.turnId) : undefined;
    const session = !knownTurn && adapterEvent.sessionId
      ? this.deps.sessionRepo.getByThreadId(adapterEvent.sessionId) ?? this.deps.sessionRepo.get(adapterEvent.sessionId)
      : null;
    const ref = knownTurn ?? this.resolveTurn(adapterEvent, session?.id);
    const sessionId = ref?.sessionId ?? session?.id;
    const taskId = ref?.taskId;
    const sequence = this.nextSequence(sessionId);

    const base = {
      id: createId("evt"),
      sessionId,
      taskId,
      turnId: adapterEvent.turnId,
      itemId: adapterEvent.itemId,
      sequence,
      timestamp: adapterEvent.timestamp,
    };

    const payload = adapterEvent.payload as Record<string, unknown>;

    switch (adapterEvent.type) {
      case "turn.started":
        if (!ref || !adapterEvent.turnId || !this.markTaskRunning(ref, adapterEvent.turnId)) return null;
        return { ...base, type: "task.started", payload };

      case "turn.completed": {
        const status = (payload.turn as { status?: string } | undefined)?.status;
        const coreType = status === "interrupted" ? "task.interrupted" : status === "failed" ? "task.failed" : "task.completed";
        if (!this.markTaskEnded(ref, sessionId, coreType, payload)) return null;
        return { ...base, type: coreType, payload };
      }

      case "agent.message.delta":
        if (typeof payload.delta === "string") {
          const buffer = this.getAgentBuffer(base);
          if (buffer) buffer.content += payload.delta;
        }
        return { ...base, type: "message.delta", payload };

      case "reasoning.delta":
        return null;

      case "item.started":
        if (!isAgentItem(payload)) return null;
        this.getAgentBuffer(base);
        return { ...base, type: "message.started", payload };

      case "item.completed":
        if (!isAgentItem(payload)) return null;
        this.getAgentBuffer(base);
        if (base.itemId) this.flushAgentMessage(base.itemId, (payload.item as { text?: unknown }).text);
        return { ...base, type: "message.completed", payload };

      case "tool.started":
      case "shell.started":
        this.recordToolStarted(base, payload);
        return { ...base, type: "tool.started", payload };

      case "shell.output":
        this.recordToolOutput(adapterEvent.itemId, payload.delta);
        return { ...base, type: "tool.output", payload };

      case "tool.completed":
      case "shell.completed":
        this.recordToolCompleted(base, payload);
        return { ...base, type: "tool.completed", payload };

      case "file.changed":
        if (payload.item) this.recordToolCompleted(base, payload);
        return { ...base, type: "file.changed", payload };

      case "diff.updated":
        return { ...base, type: "diff.updated", payload };

      case "token.usage":
        return { ...base, type: "token.usage", payload };

      case "approval.requested":
        // Approval records are owned by the Core ApprovalManager, which also
        // transitions task/session state; do not double-emit here.
        return null;

      case "approval.resolved":
        return null;

      case "agent.error":
        return { ...base, type: "core.error", payload };

      case "connection.status":
        return null;

      default:
        return null; // unknown/irrelevant adapter events are dropped, not treated as errors
    }
  }

  private resolveTurn(event: DicodeEvent, sessionId: string | undefined): TurnRef | undefined {
    if (!event.turnId) return undefined;
    if (!sessionId || event.type !== "turn.started") return undefined;
    const taskId = this.deps.stateManager.getState().tasks.runningBySession[sessionId];
    const task = taskId ? this.deps.taskRepo.get(taskId) : null;
    if (task?.status !== "queued" || task.turnId) return undefined;
    const ref = { sessionId, taskId: task.id };
    this.turnIndex.set(event.turnId, ref);
    return ref;
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

  private getAgentBuffer({ sessionId, taskId, turnId, itemId, timestamp }: Pick<CoreEvent, "sessionId" | "taskId" | "turnId" | "itemId" | "timestamp">): AgentBuffer | undefined {
    if (!sessionId || !itemId) return;
    let buffer = this.agentBuffers.get(itemId);
    if (!buffer) {
      buffer = { sessionId, taskId: taskId ?? null, turnId: turnId ?? null, content: "", startedAt: timestamp };
      this.agentBuffers.set(itemId, buffer);
    }
    return buffer;
  }

  private flushAgentMessage(itemId: string, finalText?: unknown): void {
    const buffer = this.agentBuffers.get(itemId);
    if (!buffer) return;
    this.agentBuffers.delete(itemId);
    const content = stringOr(finalText, buffer.content);
    if (!content) return;
    const record: MessageRecord = {
      id: createId("msg"),
      sessionId: buffer.sessionId,
      taskId: buffer.taskId,
      turnId: buffer.turnId,
      itemId,
      role: "assistant",
      content,
      sequence: this.deps.messageRepo.maxSequence(buffer.sessionId) + 1,
      createdAt: buffer.startedAt,
    };
    try {
      this.deps.messageRepo.insert(record);
    } catch {
      // ignore
    }
  }

  private recordToolStarted(event: Pick<CoreEvent, "sessionId" | "turnId" | "itemId" | "taskId" | "timestamp">, payload: Record<string, unknown>): ToolExecutionRecord | null {
    if (!event.sessionId || !event.itemId) return null;
    const item = payload.item as Record<string, unknown> | undefined;
    const files = Array.isArray(item?.changes) ? item.changes as { path?: unknown }[] : [];
    const firstPath = files[0]?.path;
    const fileLabel = typeof firstPath === "string" ? firstPath + (files.length > 1 ? ` +${files.length - 1}` : "") : undefined;
    const label = [item?.command, item?.tool, item?.query, item?.name, fileLabel].find((value) => typeof value === "string");
    const record: ToolExecutionRecord = {
      id: createId("tool"),
      sessionId: event.sessionId,
      taskId: event.taskId ?? null,
      turnId: event.turnId ?? null,
      itemId: event.itemId ?? null,
      toolName: stringOr(label, stringOr(item?.type, "tool")),
      toolType: stringOr(item?.type, "tool"),
      status: "running",
      input: (item?.arguments as Record<string, unknown>) ?? {},
      output: null,
      durationMs: null,
      createdAt: event.timestamp,
    };
    try {
      this.deps.toolRepo.insert(record);
    } catch {
      // ignore
    }
    return record;
  }

  private recordToolOutput(itemId: string | undefined, delta: unknown): void {
    if (!itemId || typeof delta !== "string") return;
    const existing = this.deps.toolRepo.getByItemId(itemId);
    if (!existing) return;
    existing.output = ((existing.output ?? "") + delta).slice(-16_000);
    this.deps.toolRepo.update(existing);
  }

  private recordToolCompleted(event: Pick<CoreEvent, "sessionId" | "turnId" | "itemId" | "taskId" | "timestamp">, payload: Record<string, unknown>): void {
    if (!event.itemId) return;
    const existing = this.deps.toolRepo.getByItemId(event.itemId) ?? this.recordToolStarted(event, payload);
    if (!existing) return;
    const item = payload.item as Record<string, unknown> | undefined;
    existing.status = item?.status === "failed" || item?.status === "declined" || item?.success === false || (typeof item?.exitCode === "number" && item.exitCode !== 0)
      ? "failed"
      : "completed";
    const output = item?.aggregatedOutput ?? item?.result ?? item?.error ?? item?.changes;
    if (output != null) {
      existing.output = (typeof output === "string" ? output : JSON.stringify(output)).slice(-16_000);
    }
    existing.durationMs = typeof item?.durationMs === "number" ? item.durationMs : Math.max(0, event.timestamp - existing.createdAt);
    try {
      this.deps.toolRepo.update(existing);
    } catch {
      // ignore
    }
  }

  private markTaskRunning(ref: TurnRef, turnId: string): boolean {
    const task = this.deps.taskRepo.get(ref.taskId);
    if (task?.status === "queued") {
      task.turnId = turnId;
      task.status = "running";
      task.startedAt = task.startedAt ?? nowMs();
      this.deps.taskRepo.update(task);
      this.deps.stateManager.update((s) => {
        if (s.tasks.tasks[task.id]) s.tasks.tasks[task.id] = task;
        if (s.sessions.sessions[ref.sessionId]) s.sessions.sessions[ref.sessionId].status = "running";
      });
      return true;
    }
    return false;
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

  private markTaskEnded(ref: TurnRef | undefined, sessionId: string | undefined, coreType: CoreEventType, payload: Record<string, unknown>) {
    if (!ref || !sessionId) return null;
    const task = this.deps.taskRepo.get(ref.taskId);
    if (!task || task.completedAt !== null) return null;
    const taskStatus = coreType === "task.completed" ? "completed" : coreType === "task.interrupted" ? "interrupted" : "failed";
    task.status = taskStatus;
    task.completedAt = nowMs();
    task.durationMs = task.completedAt - (task.startedAt ?? task.createdAt);
    const turn = payload.turn as { error?: { message?: unknown } } | undefined;
    if (taskStatus === "failed") task.error = stringOr(turn?.error?.message, "Turn failed");
    this.deps.taskRepo.update(task);
    if (task.turnId) {
      this.deps.toolRepo.finishRunning(task.turnId, task.completedAt);
      for (const [itemId, buffer] of this.agentBuffers) {
        if (buffer.turnId === task.turnId) this.flushAgentMessage(itemId);
      }
    }
    const persistedSession = this.deps.sessionRepo.get(sessionId);
    if (persistedSession) {
      persistedSession.status = taskStatus;
      persistedSession.updatedAt = task.completedAt;
      persistedSession.lastActivityAt = task.completedAt;
      this.deps.sessionRepo.update(persistedSession);
    }
    this.deps.stateManager.update((s) => {
      if (s.tasks.tasks[task.id]) s.tasks.tasks[task.id] = task;
      delete s.tasks.runningBySession[sessionId];
      if (s.sessions.sessions[sessionId] && persistedSession) s.sessions.sessions[sessionId] = persistedSession;
    });
    return task;
  }
}

function isAgentItem(payload: Record<string, unknown>): boolean {
  const item = payload.item as Record<string, unknown> | undefined;
  return item?.type === "agentMessage";
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}
