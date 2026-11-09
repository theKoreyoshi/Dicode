import { join } from "node:path";
import { CodexClient } from "@dicode/codex-adapter";
import type { ModelInfo } from "@dicode/codex-adapter";
import type { ApprovalDecision } from "../approval/approval-types.js";
import { ApprovalManager } from "../approval/approval-manager.js";
import { CapabilityManager } from "../capability/capability-manager.js";
import type { CoreCapabilities } from "../capability/capability-types.js";
import { ConfigManager } from "../config/config-manager.js";
import type { DicodeConfig, DicodeConfigPatch } from "../config/config-types.js";
import { ContextManager } from "../context/context-manager.js";
import { CoreNotReadyError } from "../errors/core-errors.js";
import type { CoreEvent } from "../event/event-types.js";
import { EventManager } from "../event/event-manager.js";
import type { ProjectInfo } from "../project/project-types.js";
import { ProjectManager } from "../project/project-manager.js";
import type { CreateSessionOptions, ListSessionsOptions, SessionInfo } from "../session/session-types.js";
import { SessionManager } from "../session/session-manager.js";
import { Database } from "../storage/database.js";
import {
  ApprovalRepository,
  EventRepository,
  MessageRepository,
  ProjectRepository,
  SessionRepository,
  TaskRepository,
  ToolExecutionRepository,
} from "../storage/repositories.js";
import type { MessageRecord } from "../storage/storage-types.js";
import { StateManager } from "../state/state-manager.js";
import type { DicodeState } from "../state/state-types.js";
import type { MessageInput, TaskInfo } from "../task/task-types.js";
import { TaskManager } from "../task/task-manager.js";
import type { AgentAdapter } from "./agent-adapter.js";
import type { CoreStatus } from "./lifecycle.js";

export interface DicodeCoreOptions {
  configDir?: string;
  dataDir?: string;
  adapter?: AgentAdapter;
}

export class DicodeCore {
  private readonly adapter: AgentAdapter;
  private readonly configManager: ConfigManager;
  private database!: Database;
  private stateManager!: StateManager;
  private eventManager!: EventManager;
  private projectManager!: ProjectManager;
  private sessionManager!: SessionManager;
  private taskManager!: TaskManager;
  private approvalManager!: ApprovalManager;
  private capabilityManager = new CapabilityManager();
  private contextManager!: ContextManager;
  private repos!: {
    project: ProjectRepository;
    session: SessionRepository;
    task: TaskRepository;
    message: MessageRepository;
    event: EventRepository;
    approval: ApprovalRepository;
    tool: ToolExecutionRepository;
  };
  private status: CoreStatus = "stopped";
  private unsubscribeAdapterEvent: (() => void) | null = null;
  private unsubscribeAdapterStatus: (() => void) | null = null;
  private unsubscribeApproval: (() => void) | null = null;
  private pendingSubscribers: Array<(event: CoreEvent) => void> = [];
  private readonly dataDirOption?: string;

  constructor(options: DicodeCoreOptions = {}) {
    this.configManager = new ConfigManager({
      configPath: options.configDir ? join(options.configDir, "config.json") : undefined,
    });
    this.dataDirOption = options.dataDir;
    this.adapter = options.adapter ?? new CodexClient();
  }

  async initialize(): Promise<void> {
    if (this.status === "ready" || this.status === "initializing") return;
    this.setStatus("initializing");

    const config = this.configManager.load();
    const dataDir = this.dataDirOption ?? config.storage.dataDirectory ?? defaultDataDir();
    this.database = new Database({ path: join(dataDir, "dicode.db") });
    this.repos = this.buildRepositories();

    this.stateManager = new StateManager(createInitialState(config));
    this.eventManager = new EventManager({
      stateManager: this.stateManager,
      sessionRepo: this.repos.session,
      taskRepo: this.repos.task,
      messageRepo: this.repos.message,
      eventRepo: this.repos.event,
      toolRepo: this.repos.tool,
    });
    for (const listener of this.pendingSubscribers.splice(0)) {
      this.eventManager.subscribe(listener);
    }

    this.projectManager = new ProjectManager(this.repos.project, this.stateManager, this.eventManager);
    this.sessionManager = new SessionManager(this.adapter, this.repos.session, this.stateManager, this.eventManager);
    this.taskManager = new TaskManager(
      this.adapter,
      this.repos.session,
      this.repos.task,
      this.repos.message,
      this.stateManager,
      this.eventManager,
    );
    this.approvalManager = new ApprovalManager(
      this.adapter.approvalManager,
      this.repos.approval,
      this.repos.task,
      this.stateManager,
      this.eventManager,
      {
        resolve: (threadId, turnId) => ({
          sessionId: this.sessionManager.findByThreadId(threadId)?.id,
          taskId: turnId ? this.eventManager.getTurnRef(turnId)?.taskId : undefined,
        }),
      },
    );
    this.contextManager = new ContextManager({ projectPath: "", cwd: process.cwd(), references: [], metadata: {} });

    await this.adapter.start();
    this.capabilityManager.setFromAdapter(this.adapter.getCapabilities(), adapterMethodSet());

    this.unsubscribeAdapterEvent = this.adapter.onEvent((event) => this.eventManager.handleAdapterEvent(event));
    this.unsubscribeAdapterStatus = this.adapter.onStatusChange((status) => this.handleAdapterStatus(status));
    this.unsubscribeApproval = this.approvalManager.start();

    this.restoreState();
    this.setStatus("ready");
  }

  async shutdown(): Promise<void> {
    if (this.status === "stopped" || this.status === "shutting_down") return;
    this.setStatus("shutting_down");

    this.approvalManager.expirePending();
    this.unsubscribeApproval?.();
    this.unsubscribeAdapterEvent?.();
    this.unsubscribeAdapterStatus?.();
    await this.adapter.stop();
    this.database.close();
    this.setStatus("stopped");
  }

  getStatus(): CoreStatus {
    return this.status;
  }

  getCapabilities(): CoreCapabilities {
    return this.capabilityManager.get();
  }

  // Project
  openProject(path: string): ProjectInfo {
    this.requireReady();
    return this.projectManager.open(path);
  }

  getCurrentProject(): ProjectInfo | null {
    return this.projectManager.getCurrent();
  }

  listProjects(): ProjectInfo[] {
    return this.projectManager.list();
  }

  // Session
  createSession(options: CreateSessionOptions): Promise<SessionInfo> {
    this.requireReady();
    return this.sessionManager.create(options);
  }

  resumeSession(sessionId: string): Promise<SessionInfo> {
    this.requireReady();
    return this.sessionManager.resume(sessionId);
  }

  listSessions(options?: ListSessionsOptions): SessionInfo[] {
    return this.sessionManager.list(options);
  }

  switchSession(sessionId: string): void {
    this.sessionManager.switchTo(sessionId);
  }

  archiveSession(sessionId: string): Promise<void> {
    this.requireReady();
    return this.sessionManager.archive(sessionId);
  }

  deleteSession(sessionId: string): Promise<void> {
    return this.sessionManager.delete(sessionId);
  }

  forkSession(sessionId: string): Promise<SessionInfo> {
    this.requireReady();
    return this.sessionManager.fork(sessionId);
  }

  renameSession(sessionId: string, title: string): SessionInfo {
    return this.sessionManager.rename(sessionId, title);
  }

  getSession(sessionId: string): SessionInfo | null {
    return this.sessionManager.get(sessionId);
  }

  // Task
  sendMessage(sessionId: string, input: MessageInput): Promise<TaskInfo> {
    this.requireReady();
    return this.taskManager.sendMessage(sessionId, input);
  }

  steerTask(sessionId: string, input: MessageInput): Promise<void> {
    this.requireReady();
    return this.taskManager.steerTask(sessionId, input);
  }

  interruptTask(sessionId: string): Promise<void> {
    this.requireReady();
    return this.taskManager.interruptTask(sessionId);
  }

  getTask(taskId: string): TaskInfo | null {
    return this.taskManager.getTask(taskId);
  }

  listTasksBySession(sessionId: string): TaskInfo[] {
    return this.taskManager.listTasksBySession(sessionId);
  }

  getMessages(sessionId: string): MessageRecord[] {
    return this.repos.message.listBySession(sessionId);
  }

  getToolExecutions(sessionId: string) {
    return this.repos.tool.listBySession(sessionId);
  }

  // Approval
  getPendingApprovals() {
    return this.approvalManager.getPending();
  }

  listApprovals(sessionId: string) {
    return this.approvalManager.listBySession(sessionId);
  }

  respondApproval(approvalId: string, decision: ApprovalDecision): Promise<void> {
    return this.approvalManager.respond(approvalId, decision);
  }

  // Event / state / config
  subscribe(listener: (event: CoreEvent) => void): () => void {
    if (!this.eventManager) {
      this.pendingSubscribers.push(listener);
      return () => {
        const idx = this.pendingSubscribers.indexOf(listener);
        if (idx >= 0) this.pendingSubscribers.splice(idx, 1);
      };
    }
    return this.eventManager.subscribe(listener);
  }

  getState(): Readonly<DicodeState> {
    return this.stateManager.getState();
  }

  getConfig(): DicodeConfig {
    return this.configManager.get();
  }

  updateConfig(patch: DicodeConfigPatch): DicodeConfig {
    return this.configManager.update(patch);
  }

  getContext() {
    return this.contextManager.get();
  }

  async listModels(): Promise<ModelInfo[]> {
    this.requireReady();
    return this.adapter.listModels();
  }

  private buildRepositories() {
    return {
      project: new ProjectRepository(this.database),
      session: new SessionRepository(this.database),
      task: new TaskRepository(this.database),
      message: new MessageRepository(this.database),
      event: new EventRepository(this.database),
      approval: new ApprovalRepository(this.database),
      tool: new ToolExecutionRepository(this.database),
    };
  }

  private restoreState(): void {
    this.stateManager.update((s) => {
      s.project.projects = this.repos.project.list();
      for (const session of this.repos.session.list()) {
        s.sessions.sessions[session.id] = session;
      }
      for (const approval of this.repos.approval.listPending()) {
        s.approvals.approvals[approval.id] = approval;
      }
    });
    // Restore tasks per session.
    for (const session of this.repos.session.list()) {
      for (const task of this.repos.task.listBySession(session.id)) {
        this.stateManager.update((s) => {
          s.tasks.tasks[task.id] = task;
        });
      }
    }
  }

  private handleAdapterStatus(status: string): void {
    const connected = status === "ready";
    this.stateManager.update((s) => {
      s.runtime.connected = connected;
    });
    this.eventManager.emit(connected ? "runtime.connected" : "runtime.disconnected", { payload: { status } });
  }

  private requireReady(): void {
    if (this.status !== "ready") throw new CoreNotReadyError(`core is not ready (status: ${this.status})`);
  }

  private setStatus(status: CoreStatus): void {
    this.status = status;
    if (this.stateManager) {
      this.stateManager.update((s) => {
        s.runtime.status = status;
      });
    }
  }
}

function defaultDataDir(): string {
  const base = process.env.APPDATA ?? process.env.LOCALAPPDATA ?? process.cwd();
  return join(base, "Dicode", "data");
}

function createInitialState(config: DicodeConfig): DicodeState {
  return {
    runtime: { status: "initializing", connected: false },
    project: { currentProjectId: null, projects: [] },
    sessions: { currentSessionId: null, sessions: {} },
    tasks: { tasks: {}, runningBySession: {} },
    approvals: { approvals: {} },
    capabilities: {
      sessionCreate: false,
      sessionResume: false,
      sessionList: false,
      sessionFork: false,
      sessionArchive: false,
      sessionDelete: false,
      taskStart: false,
      taskSteer: false,
      taskInterrupt: false,
      modelList: false,
      approval: false,
      mcp: false,
      skills: false,
    },
    config,
  };
}

function adapterMethodSet(): Set<string> {
  return new Set([
    "thread/start",
    "thread/resume",
    "thread/list",
    "thread/fork",
    "thread/archive",
    "thread/delete",
    "turn/start",
    "turn/steer",
    "turn/interrupt",
    "model/list",
  ]);
}

export function createDicodeCore(options?: DicodeCoreOptions): DicodeCore {
  return new DicodeCore(options);
}
