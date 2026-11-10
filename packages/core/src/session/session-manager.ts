import type { AgentAdapter } from "../application/agent-adapter.js";
import type { EventManager } from "../event/event-manager.js";
import { SessionError } from "../errors/core-errors.js";
import type { SessionRepository } from "../storage/repositories.js";
import type { SessionStatus } from "../storage/storage-types.js";
import type { StateManager } from "../state/state-manager.js";
import { createId } from "../utils/id.js";
import { nowMs } from "../utils/time.js";
import type { CreateSessionOptions, ListSessionsOptions, SessionInfo } from "./session-types.js";

export class SessionManager {
  constructor(
    private readonly adapter: AgentAdapter,
    private readonly sessionRepo: SessionRepository,
    private readonly stateManager: StateManager,
    private readonly eventManager: EventManager,
  ) {}

  async create(options: CreateSessionOptions): Promise<SessionInfo> {
    const cwd = options.cwd ?? options.projectPath;
    const thread = await this.adapter.createThread({
      cwd,
      model: options.model,
    });

    const now = nowMs();
    const session: SessionInfo = {
      id: createId("session"),
      codexThreadId: thread.id,
      projectPath: options.projectPath,
      title: options.title ?? "",
      cwd,
      model: options.model ?? thread.model ?? null,
      status: "idle",
      createdAt: now,
      updatedAt: now,
      lastActivityAt: now,
      archived: false,
      metadata: options.metadata ?? {},
    };

    this.sessionRepo.insert(session);
    this.stateManager.update((s) => {
      s.sessions.sessions[session.id] = session;
      s.sessions.currentSessionId = session.id;
    });
    this.eventManager.emit("session.created", { sessionId: session.id, payload: session });
    return session;
  }

  async resume(sessionId: string): Promise<SessionInfo> {
    const session = this.requireSession(sessionId);
    await this.adapter.resumeThread(session.codexThreadId, { cwd: session.cwd });
    session.lastActivityAt = nowMs();
    session.updatedAt = nowMs();
    this.sessionRepo.update(session);
    this.stateManager.update((s) => {
      s.sessions.sessions[session.id] = session;
      s.sessions.currentSessionId = session.id;
    });
    this.eventManager.emit("session.updated", { sessionId: session.id, payload: session });
    return session;
  }

  list(options: ListSessionsOptions = {}): SessionInfo[] {
    const sessions = this.sessionRepo.list({ projectPath: options.projectPath, archived: options.archived });
    return options.limit ? sessions.slice(0, options.limit) : sessions;
  }

  get(sessionId: string): SessionInfo | null {
    return this.sessionRepo.get(sessionId);
  }

  findByThreadId(codexThreadId: string): SessionInfo | null {
    return this.sessionRepo.getByThreadId(codexThreadId);
  }

  switchTo(sessionId: string): void {
    this.requireSession(sessionId);
    this.stateManager.update((s) => {
      s.sessions.currentSessionId = sessionId;
    });
  }

  async archive(sessionId: string): Promise<void> {
    const session = this.requireSession(sessionId);
    await this.adapter.archiveThread(session.codexThreadId);
    session.archived = true;
    session.updatedAt = nowMs();
    this.sessionRepo.update(session);
    this.stateManager.update((s) => {
      if (s.sessions.sessions[session.id]) s.sessions.sessions[session.id] = session;
    });
    this.eventManager.emit("session.archived", { sessionId: session.id, payload: session });
  }

  async delete(sessionId: string): Promise<void> {
    const session = this.requireSession(sessionId);
    // Dicode-level removal only; the Codex thread history is not deleted.
    this.sessionRepo.delete(session.id);
    this.stateManager.update((s) => {
      delete s.sessions.sessions[session.id];
      if (s.sessions.currentSessionId === session.id) s.sessions.currentSessionId = null;
    });
    this.eventManager.emit("session.deleted", { sessionId: session.id, payload: { id: session.id } });
  }

  async fork(sessionId: string, options: { cwd?: string; model?: string } = {}): Promise<SessionInfo> {
    const source = this.requireSession(sessionId);
    const thread = await this.adapter.forkThread(source.codexThreadId, options);
    const now = nowMs();
    const session: SessionInfo = {
      id: createId("session"),
      codexThreadId: thread.id,
      projectPath: source.projectPath,
      title: `${source.title || "fork"} (fork)`,
      cwd: options.cwd ?? source.cwd,
      model: options.model ?? source.model,
      status: "idle",
      createdAt: now,
      updatedAt: now,
      lastActivityAt: now,
      archived: false,
      metadata: { ...source.metadata, forkedFrom: source.id },
    };
    this.sessionRepo.insert(session);
    this.stateManager.update((s) => {
      s.sessions.sessions[session.id] = session;
    });
    this.eventManager.emit("session.created", { sessionId: session.id, payload: session });
    return session;
  }

  rename(sessionId: string, title: string): SessionInfo {
    const session = this.requireSession(sessionId);
    session.title = title;
    session.updatedAt = nowMs();
    this.sessionRepo.update(session);
    this.stateManager.update((s) => {
      if (s.sessions.sessions[session.id]) s.sessions.sessions[session.id] = session;
    });
    this.eventManager.emit("session.updated", { sessionId: session.id, payload: session });
    return session;
  }

  setStatus(sessionId: string, status: SessionStatus): void {
    const session = this.requireSession(sessionId);
    session.status = status;
    session.updatedAt = nowMs();
    this.sessionRepo.update(session);
    this.stateManager.update((s) => {
      if (s.sessions.sessions[session.id]) s.sessions.sessions[session.id] = session;
    });
  }

  private requireSession(sessionId: string): SessionInfo {
    const session = this.sessionRepo.get(sessionId);
    if (!session) throw new SessionError("SESSION_NOT_FOUND", `session not found: ${sessionId}`);
    return session;
  }
}

export function deriveTitle(text: string, maxLength = 60): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength)}…`;
}
