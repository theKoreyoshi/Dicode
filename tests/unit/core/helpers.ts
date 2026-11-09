import type { AdapterCapabilities, ApprovalRequest, DicodeEvent } from "@dicode/codex-adapter";
import { Database } from "@dicode/core";
import {
  ApprovalRepository,
  EventRepository,
  MessageRepository,
  ProjectRepository,
  SessionRepository,
  TaskRepository,
  ToolExecutionRepository,
} from "@dicode/core";
import { EventManager } from "@dicode/core";
import { StateManager } from "@dicode/core";
import { defaultConfig } from "@dicode/core";
import type { AgentAdapter, AgentApprovalManager } from "@dicode/core";

export interface TestHarness {
  db: Database;
  repos: {
    project: ProjectRepository;
    session: SessionRepository;
    task: TaskRepository;
    message: MessageRepository;
    event: EventRepository;
    approval: ApprovalRepository;
    tool: ToolExecutionRepository;
  };
  state: StateManager;
  events: EventManager;
  adapter: MockAdapter;
}

export function createHarness(): TestHarness {
  const db = new Database({ path: ":memory:" });
  const repos = {
    project: new ProjectRepository(db),
    session: new SessionRepository(db),
    task: new TaskRepository(db),
    message: new MessageRepository(db),
    event: new EventRepository(db),
    approval: new ApprovalRepository(db),
    tool: new ToolExecutionRepository(db),
  };
  const state = new StateManager(initialState());
  const events = new EventManager({
    stateManager: state,
    sessionRepo: repos.session,
    taskRepo: repos.task,
    messageRepo: repos.message,
    eventRepo: repos.event,
    toolRepo: repos.tool,
  });
  const adapter = createMockAdapter();
  return { db, repos, state, events, adapter };
}

export type MockAdapter = AgentAdapter & {
  emittedEvents: DicodeEvent[];
  emitEvent(event: DicodeEvent): void;
  approvalListeners: Array<(request: ApprovalRequest) => void>;
};

function createMockAdapter(): MockAdapter {
  let onEventFn: ((event: DicodeEvent) => void) | null = null;
  const adapter: MockAdapter = {
    emittedEvents: [],
    approvalListeners: [],
    start: async () => {},
    stop: async () => {},
    getStatus: () => "ready",
    getCapabilities: () => ({ initialized: true, experimentalApi: true }) as AdapterCapabilities,
    createThread: async () => ({ id: "thread-1", model: null, modelProvider: null, cwd: null }),
    resumeThread: async () => ({ id: "thread-1", model: null, modelProvider: null, cwd: null }),
    listThreads: async () => [],
    forkThread: async () => ({ id: "thread-2", model: null, modelProvider: null, cwd: null }),
    archiveThread: async () => {},
    startTurn: async () => ({ id: "turn-1", status: "inProgress" }),
    steerTurn: async () => {},
    interruptTurn: async () => {},
    listModels: async () => [],
    onEvent: (listener) => {
      onEventFn = listener;
      return () => {};
    },
    onStatusChange: () => () => {},
    emitEvent(event: DicodeEvent) {
      adapter.emittedEvents.push(event);
      onEventFn?.(event);
    },
    approvalManager: {
      getPendingApprovals: () => [],
      respond: async () => {},
      reject: async () => {},
      onApproval: (listener) => {
        adapter.approvalListeners.push(listener);
        return () => {};
      },
      clear: () => {},
    } as AgentApprovalManager,
  };
  return adapter;
}

function initialState() {
  const config = defaultConfig();
  return {
    runtime: { status: "ready" as const, connected: true },
    project: { currentProjectId: null, projects: [] },
    sessions: { currentSessionId: null, sessions: {} },
    tasks: { tasks: {}, runningBySession: {} },
    approvals: { approvals: {} },
    capabilities: {
      sessionCreate: true,
      sessionResume: true,
      sessionList: true,
      sessionFork: true,
      sessionArchive: true,
      sessionDelete: true,
      taskStart: true,
      taskSteer: true,
      taskInterrupt: true,
      modelList: true,
      approval: true,
      mcp: false,
      skills: false,
    },
    config,
  };
}
