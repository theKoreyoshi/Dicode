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

    // Reflect the auto-title back to storage if it was empty.
    const freshSession = this.sessionRepo.get(sessionId);
    if (freshSession && !freshSession.title) {
      freshSession.title = deriveTitle(input.text);
      this.sessionRepo.update(freshSession);
    }

    try {
      const turn = await this.adapter.startTurn(session.codexThreadId, {
        text: input.text,
        model: input.model,
        effort: input.effort,
      });
      task.turnId = turn.id;
      task.status = "running";
      task.startedAt = nowMs();
      this.taskRepo.update(task);
      this.eventManager.registerTurn(turn.id, sessionId, task.id);
      this.stateManager.update((s) => {
        if (s.tasks.tasks[task.id]) s.tasks.tasks[task.id] = task;
      });
      this.eventManager.emit("task.started", { sessionId, taskId: task.id, turnId: turn.id, payload: task });
      return task;
    } catch (error) {
      task.status = "failed";
      task.error = (error as Error).message;
      task.completedAt = nowMs();
      this.taskRepo.update(task);
      this.stateManager.update((s) => {
        if (s.tasks.tasks[task.id]) s.tasks.tasks[task.id] = task;
        delete s.tasks.runningBySession[sessionId];
      });
      this.eventManager.emit("task.failed", { sessionId, taskId: task.id, payload: task });
      throw error;
    }
  }

  async steerTask(sessionId: string, input: MessageInput): Promise<void> {
    const session = this.requireSession(sessionId);
    await this.adapter.steerTurn(session.codexThreadId, { text: input.text });
    this.eventManager.emit("task.updated", { sessionId, payload: { input: input.text } });
  }

  async interruptTask(sessionId: string): Promise<void> {
    const session = this.requireSession(sessionId);
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
