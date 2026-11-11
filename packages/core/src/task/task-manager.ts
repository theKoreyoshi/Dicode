import type { AgentAdapter } from "../application/agent-adapter.js";
import type { EventManager } from "../event/event-manager.js";
import { SessionError, TaskError } from "../errors/core-errors.js";
import type { MessageRepository, SessionRepository, TaskRepository } from "../storage/repositories.js";
import type { MessageRecord, TaskRecord } from "../storage/storage-types.js";
import type { StateManager } from "../state/state-manager.js";
import { createId } from "../utils/id.js";
import { nowMs } from "../utils/time.js";
import { deriveTitle } from "../session/session-manager.js";
import type { MessageInput, TaskInfo } from "./task-types.js";

export class TaskManager {
  private readonly pendingInterrupts = new Set<string>();

  constructor(
    private readonly adapter: AgentAdapter,
    private readonly sessionRepo: SessionRepository,
    private readonly taskRepo: TaskRepository,
    private readonly messageRepo: MessageRepository,
    private readonly stateManager: StateManager,
    private readonly eventManager: EventManager,
  ) {}

  async sendMessage(sessionId: string, input: MessageInput): Promise<TaskInfo> {
    const session = this.requireSession(sessionId);
    this.assertNoRunningTask(sessionId);

    const now = nowMs();
    const task: TaskRecord = {
      id: createId("task"),
      sessionId,
      turnId: null,
      status: "queued",
      inputText: input.text,
      error: null,
      createdAt: now,
      startedAt: null,
      completedAt: null,
      durationMs: null,
      ownerPid: process.pid,
    };
    this.taskRepo.insert(task);

    const userMessage: MessageRecord = {
      id: createId("msg"),
      sessionId,
      taskId: task.id,
      turnId: null,
      itemId: null,
      role: "user",
      content: input.text,
      sequence: this.nextMessageSequence(sessionId),
      createdAt: now,
    };
    this.messageRepo.insert(userMessage);

    this.stateManager.update((s) => {
      s.tasks.tasks[task.id] = task;
      s.tasks.runningBySession[sessionId] = task.id;
      const sess = s.sessions.sessions[sessionId];
      if (sess) {
        sess.status = "running";
        sess.lastActivityAt = now;
        if (!sess.title) sess.title = deriveTitle(input.text);
      }
    });
    this.eventManager.emit("task.created", { sessionId, taskId: task.id, payload: task });
    this.eventManager.emit("message.submitted", { sessionId, taskId: task.id, payload: userMessage });

    try {
      const turn = await this.adapter.startTurn(session.codexThreadId, {
        text: input.text,
        model: input.model,
        effort: input.effort,
        mode: input.mode,
        permissionMode: input.permissionMode,
      });
      this.eventManager.registerTurn(turn.id, sessionId, task.id);
      const current = this.taskRepo.get(task.id) ?? task;
      if (current.status === "queued") {
        current.turnId = turn.id;
        current.status = "running";
        current.startedAt = nowMs();
        this.taskRepo.update(current);
        this.stateManager.update((s) => {
          s.tasks.tasks[task.id] = current;
        });
        this.eventManager.emit("task.started", { sessionId, taskId: task.id, turnId: turn.id, payload: current });
        if (turn.status !== "inProgress") this.eventManager.endTask(sessionId, task.id, turn.status, turn.error ?? undefined);
      }
      const freshSession = this.sessionRepo.get(sessionId);
      if (freshSession) {
        freshSession.title ||= deriveTitle(input.text);
        freshSession.lastActivityAt = Math.max(now, freshSession.lastActivityAt);
        if (this.stateManager.getState().tasks.runningBySession[sessionId] === task.id) {
          freshSession.status = this.stateManager.getState().sessions.sessions[sessionId]?.status ?? "running";
        }
        freshSession.model = input.model ?? freshSession.model;
        if (freshSession.customModel && input.model) freshSession.customModel = { ...freshSession.customModel, model: input.model };
        this.sessionRepo.update(freshSession);
        this.stateManager.update((s) => {
          const sess = s.sessions.sessions[sessionId];
          if (sess) {
            sess.model = freshSession.model;
            sess.customModel = freshSession.customModel;
            sess.title = freshSession.title;
            sess.lastActivityAt = freshSession.lastActivityAt;
          }
        });
        this.eventManager.emit("session.updated", { sessionId, payload: freshSession });
      }
      if (this.pendingInterrupts.delete(task.id) && this.getRunningTask(sessionId)?.id === task.id) {
        try {
          await this.adapter.interruptTurn(session.codexThreadId);
        } catch (error) {
          if (this.getRunningTask(sessionId)?.id === task.id) {
            this.eventManager.emit("core.error", { sessionId, taskId: task.id, payload: { message: (error as Error).message } });
          }
        }
      }
      return this.taskRepo.get(task.id) ?? current;
    } catch (error) {
      this.pendingInterrupts.delete(task.id);
      const current = this.taskRepo.get(task.id);
      if (current?.turnId) return current;
      this.messageRepo.delete(userMessage.id);
      task.status = "failed";
      task.error = (error as Error).message;
      task.completedAt = nowMs();
      this.taskRepo.update(task);
      this.stateManager.update((s) => {
        if (s.tasks.tasks[task.id]) s.tasks.tasks[task.id] = task;
        if (s.sessions.sessions[sessionId]) s.sessions.sessions[sessionId].status = "failed";
        delete s.tasks.runningBySession[sessionId];
      });
      this.eventManager.emit("task.failed", { sessionId, taskId: task.id, payload: task });
      throw error;
    }
  }

  async steerTask(sessionId: string, input: MessageInput): Promise<void> {
    const session = this.requireSession(sessionId);
    const task = this.getRunningTask(sessionId);
    const createdAt = nowMs();
    await this.adapter.steerTurn(session.codexThreadId, { text: input.text });
    const message: MessageRecord = {
      id: createId("msg"),
      sessionId,
      taskId: task?.id ?? null,
      turnId: task?.turnId ?? null,
      itemId: null,
      role: "user",
      content: input.text,
      sequence: this.nextMessageSequence(sessionId),
      createdAt,
    };
    this.messageRepo.insert(message);
    this.eventManager.emit("message.submitted", { sessionId, taskId: task?.id, turnId: task?.turnId ?? undefined, payload: message });
    this.eventManager.emit("task.updated", { sessionId, payload: { input: input.text } });
  }

  async interruptTask(sessionId: string): Promise<void> {
    const session = this.requireSession(sessionId);
    const taskId = this.stateManager.getState().tasks.runningBySession[sessionId];
    const task = taskId ? this.taskRepo.get(taskId) : null;
    if (task?.status === "queued" && !task.turnId) {
      this.pendingInterrupts.add(task.id);
      return;
    }
    if (task) this.pendingInterrupts.delete(task.id);
    await this.adapter.interruptTurn(session.codexThreadId);
  }

  getTask(taskId: string): TaskInfo | null {
    return this.taskRepo.get(taskId);
  }

  listTasksBySession(sessionId: string): TaskInfo[] {
    return this.taskRepo.listBySession(sessionId);
  }

  getRunningTask(sessionId: string): TaskInfo | null {
    return this.taskRepo.getRunningBySession(sessionId);
  }

  recoverOrphanedTasks(): Set<string> {
    const recovered = new Set<string>();
    for (const task of this.taskRepo.listActive()) {
      if (task.ownerPid && isProcessAlive(task.ownerPid)) continue;
      this.eventManager.endTask(task.sessionId, task.id, "interrupted");
      recovered.add(task.sessionId);
    }
    return recovered;
  }

  endOwnedTasks(status: "failed" | "interrupted", reason?: string): Set<string> {
    const sessions = Object.entries(this.stateManager.getState().tasks.runningBySession);
    for (const [sessionId, taskId] of sessions) this.eventManager.endTask(sessionId, taskId, status, reason);
    return new Set(sessions.map(([sessionId]) => sessionId));
  }

  private assertNoRunningTask(sessionId: string): void {
    const running = this.taskRepo.getRunningBySession(sessionId);
    if (running) {
      throw new TaskError("TASK_LOCKED", `session already has an active task: ${running.id}`);
    }
  }

  private requireSession(sessionId: string) {
    const session = this.sessionRepo.get(sessionId);
    if (!session) throw new SessionError("SESSION_NOT_FOUND", `session not found: ${sessionId}`);
    return session;
  }

  private nextMessageSequence(sessionId: string): number {
    return this.messageRepo.maxSequence(sessionId) + 1;
  }
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}
