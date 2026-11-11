import { readMessagePresentation, readToolInput, readToolPresentation, type ApprovalInfo, type CoreEvent, type MessageRecord, type ModelInfo, type SessionInfo, type ToolExecutionRecord } from "@dicode/core";

export interface UiMessage extends Pick<MessageRecord, "phase" | "kind" | "incomplete"> {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming: boolean;
  timestamp?: number;
  taskId?: string;
  turnId?: string;
}

export interface UiTool {
  id: string;
  turnId?: string;
  type: string;
  label: string;
  input?: Record<string, unknown>;
  status: "running" | "completed" | "failed";
  timestamp: number;
  output?: string;
  durationMs?: number;
  exitCode?: number;
}

export interface UiThought {
  id: string;
  turnId?: string;
  timestamp: number;
  durationMs: number;
}

export interface UiTokenUsage {
  contextTokens: number;
  modelContextWindow: number | null;
}

export interface UiPlan {
  turnId: string;
  timestamp: number;
  explanation?: string;
  steps: Array<{ step: string; status: "pending" | "inProgress" | "completed" }>;
}

export type UiStatus = "initializing" | "ready" | "running" | "waiting_approval" | "error";

export interface UiState {
  status: UiStatus;
  projectPath: string | null;
  projectName: string | null;
  sessionId: string | null;
  sessions: SessionInfo[];
  messages: UiMessage[];
  tools: UiTool[];
  thoughts: UiThought[];
  diff: string | null;
  plan: UiPlan | null;
  tokenUsage: UiTokenUsage | null;
  queuedPrompt: string | null;
  currentTaskId: string | null;
  pendingApprovals: ApprovalInfo[];
  sidebarVisible: boolean;
  error: string | null;
  notice: string | null;
  models: ModelInfo[];
  selectedModel: string | null;
  selectedEffort: string | null;
}

interface SessionView {
  messages: MessageRecord[];
  tools: ToolExecutionRecord[];
  diff: string | null;
  plan?: UiPlan | null;
  tokenUsage: UiTokenUsage | null;
  queuedPrompt: string | null;
  taskId: string | null;
  approvals: ApprovalInfo[];
}

export type UiAction =
  | { type: "CORE_EVENT"; event: CoreEvent }
  | { type: "SET_PROJECT"; path: string; name: string }
  | { type: "SET_SESSIONS"; sessions: SessionInfo[] }
  | { type: "SET_SESSION"; sessionId: string | null; view?: SessionView }
  | { type: "SET_QUEUED_PROMPT"; sessionId: string; prompt: string | null }
  | { type: "TOGGLE_SIDEBAR" }
  | { type: "SET_ERROR"; message: string | null }
  | { type: "SET_NOTICE"; message: string | null }
  | { type: "SET_MODELS"; models: ModelInfo[] }
  | { type: "SET_SELECTED_MODEL"; model: string | null }
  | { type: "SET_SELECTED_EFFORT"; effort: string | null }
  | { type: "SET_STATUS"; status: UiStatus };

export function createInitialUiState(): UiState {
  return {
    status: "initializing",
    projectPath: null,
    projectName: null,
    sessionId: null,
    sessions: [],
    messages: [],
    tools: [],
    thoughts: [],
    diff: null,
    plan: null,
    tokenUsage: null,
    queuedPrompt: null,
    currentTaskId: null,
    pendingApprovals: [],
    sidebarVisible: true,
    error: null,
    notice: null,
    models: [],
    selectedModel: null,
    selectedEffort: null,
  };
}

export function uiReducer(state: UiState, action: UiAction): UiState {
  switch (action.type) {
    case "CORE_EVENT":
      return reduceCoreEvent(state, action.event);
    case "SET_PROJECT":
      return { ...state, projectPath: action.path, projectName: action.name };
    case "SET_SESSIONS":
      return { ...state, sessions: action.sessions };
    case "SET_SESSION": {
      const view = action.view;
      const pendingApprovals = view?.approvals ?? [];
      return {
        ...state,
        status: pendingApprovals.length ? "waiting_approval" : view?.taskId ? "running" : "ready",
        sessionId: action.sessionId,
        messages: view?.messages.map(messageToUi) ?? [],
        tools: view?.tools.map(toolToUi) ?? [],
        thoughts: [],
        diff: view?.diff ?? null,
        plan: view?.plan ?? null,
        tokenUsage: view?.tokenUsage ?? null,
        queuedPrompt: view?.queuedPrompt ?? null,
        currentTaskId: view?.taskId ?? null,
        pendingApprovals,
        error: null,
        notice: null,
      };
    }
    case "SET_QUEUED_PROMPT":
      return state.sessionId === action.sessionId ? { ...state, queuedPrompt: action.prompt } : state;
    case "TOGGLE_SIDEBAR":
      return { ...state, sidebarVisible: !state.sidebarVisible };
    case "SET_ERROR":
      return { ...state, error: action.message };
    case "SET_NOTICE":
      return { ...state, notice: action.message };
    case "SET_MODELS":
      return { ...state, models: action.models };
    case "SET_SELECTED_MODEL":
      return { ...state, selectedModel: action.model, selectedEffort: null };
    case "SET_SELECTED_EFFORT":
      return { ...state, selectedEffort: action.effort };
    case "SET_STATUS":
      return { ...state, status: action.status };
  }
}

function reduceCoreEvent(state: UiState, event: CoreEvent): UiState {
  if (event.sessionId && event.sessionId !== state.sessionId) return state;

  switch (event.type) {
    case "task.created":
    case "task.started":
      return {
        ...state,
        status: state.pendingApprovals.length ? "waiting_approval" : "running",
        currentTaskId: event.taskId ?? state.currentTaskId,
        error: null,
      };
    case "task.completed":
    case "task.failed":
    case "task.interrupted": {
      if (event.taskId && state.currentTaskId && event.taskId !== state.currentTaskId) return state;
      const failed = event.type === "task.failed";
      const messages = failed && !event.turnId
        ? state.messages.filter((message) => message.role !== "user" || message.taskId !== event.taskId)
        : state.messages;
      const payload = record(event.payload);
      const error = typeof payload.error === "string" ? payload.error : record(record(payload.turn).error).message;
      return {
        ...state,
        status: failed ? "error" : "ready",
        currentTaskId: null,
        pendingApprovals: [],
        messages: finishMessages(messages, event.type !== "task.completed" ? event : undefined),
        tools: state.tools.map((tool) => tool.status === "running" ? { ...tool, status: "failed" } : tool),
        error: failed ? (typeof error === "string" ? error : "Codex turn failed") : null,
      };
    }
    case "message.submitted": {
      const message = messageToUi(event.payload as MessageRecord);
      return { ...state, messages: [...state.messages, message] };
    }
    case "message.started":
    case "message.delta":
    case "message.completed":
      return { ...state, messages: updateAssistantMessage(state.messages, event) };
    case "thought.completed": {
      const durationMs = record(event.payload).durationMs;
      if (typeof durationMs !== "number" || !Number.isFinite(durationMs)) return state;
      return {
        ...state,
        thoughts: [...state.thoughts, { id: event.itemId ?? event.id, turnId: event.turnId, timestamp: event.timestamp, durationMs }],
      };
    }
    case "tool.started":
    case "tool.output":
    case "tool.completed":
    case "file.changed":
      return { ...state, tools: updateTool(state.tools, event) };
    case "diff.updated":
      return { ...state, diff: readDiff(event.payload) };
    case "plan.updated": {
      const plan = readPlan(event.payload, event.timestamp);
      if (plan && state.plan?.turnId === plan.turnId) plan.timestamp = state.plan.timestamp;
      return { ...state, plan };
    }
    case "token.usage":
      return { ...state, tokenUsage: readTokenUsage(event.payload) };
    case "approval.requested": {
      const approval = event.payload as ApprovalInfo;
      return {
        ...state,
        status: "waiting_approval",
        pendingApprovals: [...state.pendingApprovals, approval],
      };
    }
    case "approval.resolved": {
      const resolved = event.payload as ApprovalInfo;
      const pending = state.pendingApprovals.filter((approval) => approval.id !== resolved.id);
      return {
        ...state,
        status: pending.length ? "waiting_approval" : state.currentTaskId ? "running" : "ready",
        pendingApprovals: pending,
      };
    }
    case "runtime.disconnected":
      return {
        ...state,
        status: "error",
        currentTaskId: null,
        queuedPrompt: null,
        pendingApprovals: [],
        messages: finishMessages(state.messages),
        error: "Codex App Server disconnected. Restart Dicode to reconnect.",
      };
    case "core.error": {
      const payload = record(event.payload);
      const message = payload.message ?? record(payload.error).message;
      return { ...state, error: typeof message === "string" ? message : "Codex reported an error" };
    }
    default:
      return state;
  }
}

function messageToUi(message: MessageRecord): UiMessage {
  return {
    id: message.itemId ?? message.id,
    role: message.role,
    content: message.content,
    streaming: false,
    timestamp: message.createdAt,
    taskId: message.taskId ?? undefined,
    turnId: message.turnId ?? undefined,
    phase: message.phase,
    kind: message.kind,
    incomplete: message.incomplete,
  };
}

function updateAssistantMessage(messages: UiMessage[], event: CoreEvent): UiMessage[] {
  const id = event.itemId;
  if (!id) return messages;
  const existing = messages.find((message) => message.id === id);
  const payload = record(event.payload);
  const item = record(payload.item);
  const completed = event.type === "message.completed";
  if (existing && !existing.streaming && !completed) return messages;
  const initial = typeof item.text === "string" ? item.text : "";
  const content = completed && typeof item.text === "string"
    ? item.text
    : (existing?.content ?? initial) + (typeof payload.delta === "string" ? payload.delta : "");
  const updated: UiMessage = {
    id,
    role: "assistant",
    content,
    streaming: !completed,
    timestamp: existing?.timestamp ?? event.timestamp,
    taskId: event.taskId ?? existing?.taskId,
    turnId: event.turnId ?? existing?.turnId,
    phase: existing?.phase,
    kind: existing?.kind,
    ...readMessagePresentation(item),
  };
  return existing ? messages.map((message) => message.id === id ? updated : message) : [...messages, updated];
}

function finishMessages(messages: UiMessage[], unsuccessful?: Pick<CoreEvent, "taskId" | "turnId">): UiMessage[] {
  return messages.filter((message) => message.content).map((message) => {
    const belongsToUnsuccessfulTurn = (unsuccessful?.taskId && message.taskId === unsuccessful.taskId) ||
      (unsuccessful?.turnId && message.turnId === unsuccessful.turnId);
    const unfinished = message.streaming || (belongsToUnsuccessfulTurn && message.role === "assistant" && !message.phase && !message.kind);
    return unfinished ? { ...message, streaming: false, incomplete: true } : message;
  });
}

function updateTool(tools: UiTool[], event: CoreEvent): UiTool[] {
  const id = event.itemId;
  if (!id) return tools;
  const existing = tools.find((tool) => tool.id === id);
  const payload = record(event.payload);
  const item = record(payload.item);
  if (!existing && !payload.item) return tools;
  const type = typeof item.type === "string" ? item.type : existing?.type ?? "tool";
  const done = event.type === "tool.completed" || (event.type === "file.changed" && Boolean(payload.item));
  const exitCode = typeof item.exitCode === "number" ? item.exitCode : existing?.exitCode;
  const failed = item.status === "failed" || item.status === "declined" || item.success === false || (exitCode != null && exitCode !== 0);
  const presentation = readToolPresentation(
    payload.item ?? (Array.isArray(payload.changes) ? { type, changes: payload.changes } : undefined),
    done ? existing?.output : undefined,
  );
  const output = presentation.output ?? (existing?.output ?? "") + (typeof payload.delta === "string" ? payload.delta : "");
  const updated: UiTool = {
    id,
    turnId: event.turnId ?? existing?.turnId,
    type,
    label: presentation.label ?? existing?.label ?? type,
    input: readToolInput(item) ?? existing?.input,
    status: done ? failed ? "failed" : "completed" : existing?.status ?? "running",
    timestamp: existing?.timestamp ?? event.timestamp,
    output: output.slice(-16_000),
    durationMs: typeof item.durationMs === "number" ? item.durationMs : existing?.durationMs,
    exitCode,
  };
  return existing ? tools.map((tool) => tool.id === id ? updated : tool) : [...tools, updated];
}

function toolToUi(tool: ToolExecutionRecord): UiTool {
  return {
    id: tool.itemId ?? tool.id,
    turnId: tool.turnId ?? undefined,
    type: tool.toolType,
    label: tool.toolName,
    input: tool.input,
    status: tool.status,
    timestamp: tool.createdAt,
    output: tool.output ?? undefined,
    durationMs: tool.durationMs ?? undefined,
  };
}

export function readDiff(payload: unknown): string | null {
  const diff = record(payload).diff;
  return typeof diff === "string" ? diff : null;
}

export function readPlan(payload: unknown, timestamp: number): UiPlan | null {
  const { turnId, explanation, plan } = record(payload);
  if (typeof turnId !== "string" || !Array.isArray(plan)) return null;
  const steps: UiPlan["steps"] = [];
  for (const entry of plan) {
    const { step, status } = record(entry);
    if (typeof step === "string" && (status === "pending" || status === "inProgress" || status === "completed")) {
      steps.push({ step, status });
    }
  }
  if (!steps.length) return null;
  return { turnId, timestamp, explanation: typeof explanation === "string" ? explanation : undefined, steps };
}

export function readTokenUsage(payload: unknown): UiTokenUsage | null {
  const usage = record(record(payload).tokenUsage);
  const contextTokens = record(usage.last).totalTokens;
  return typeof contextTokens === "number" && Number.isFinite(contextTokens) ? {
    contextTokens,
    modelContextWindow: typeof usage.modelContextWindow === "number" ? usage.modelContextWindow : null,
  } : null;
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

export function mergeStreamingDeltas(deltas: string[]): string {
  return deltas.join("");
}
