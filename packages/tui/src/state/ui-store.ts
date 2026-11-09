import type { ApprovalInfo, CoreEvent, MessageRecord, SessionInfo } from "@dicode/core";

export interface UiMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming: boolean;
}

export type UiStatus = "initializing" | "ready" | "running" | "waiting_approval" | "error";

export interface UiState {
  status: UiStatus;
  projectPath: string | null;
  projectName: string | null;
  sessionId: string | null;
  sessions: SessionInfo[];
  messages: UiMessage[];
  currentTaskId: string | null;
  pendingApprovals: ApprovalInfo[];
  sidebarVisible: boolean;
  commandPaletteOpen: boolean;
  approvalModalOpen: boolean;
  error: string | null;
  historyIndex: number;
}

export type UiAction =
  | { type: "CORE_EVENT"; event: CoreEvent }
  | { type: "SET_PROJECT"; path: string; name: string }
  | { type: "SET_SESSIONS"; sessions: SessionInfo[] }
  | { type: "SET_SESSION"; sessionId: string }
  | { type: "LOAD_MESSAGES"; messages: MessageRecord[] }
  | { type: "ADD_USER_MESSAGE"; text: string }
  | { type: "TOGGLE_SIDEBAR" }
  | { type: "TOGGLE_PALETTE" }
  | { type: "CLOSE_PALETTE" }
  | { type: "TOGGLE_APPROVAL" }
  | { type: "SET_ERROR"; message: string | null }
  | { type: "SET_STATUS"; status: UiStatus }
  | { type: "NEXT_HISTORY" }
  | { type: "PREV_HISTORY" }
  | { type: "RESET_HISTORY" };

export function createInitialUiState(): UiState {
  return {
    status: "initializing",
    projectPath: null,
    projectName: null,
    sessionId: null,
    sessions: [],
    messages: [],
    currentTaskId: null,
    pendingApprovals: [],
    sidebarVisible: true,
    commandPaletteOpen: false,
    approvalModalOpen: false,
    error: null,
    historyIndex: -1,
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
    case "SET_SESSION":
      return { ...state, sessionId: action.sessionId, messages: [], currentTaskId: null, pendingApprovals: [] };
    case "LOAD_MESSAGES":
      return { ...state, messages: action.messages.map(messageToUi) };
    case "ADD_USER_MESSAGE":
      return { ...state, messages: [...state.messages, { id: `user-${Date.now()}`, role: "user", content: action.text, streaming: false }] };
    case "TOGGLE_SIDEBAR":
      return { ...state, sidebarVisible: !state.sidebarVisible };
    case "TOGGLE_PALETTE":
      return { ...state, commandPaletteOpen: !state.commandPaletteOpen };
    case "CLOSE_PALETTE":
      return { ...state, commandPaletteOpen: false };
    case "TOGGLE_APPROVAL":
      return { ...state, approvalModalOpen: !state.approvalModalOpen };
    case "SET_ERROR":
      return { ...state, error: action.message };
    case "SET_STATUS":
      return { ...state, status: action.status };
    case "NEXT_HISTORY":
      return { ...state, historyIndex: Math.min(state.historyIndex + 1, state.messages.length - 1) };
    case "PREV_HISTORY":
      return { ...state, historyIndex: Math.max(state.historyIndex - 1, -1) };
    case "RESET_HISTORY":
      return { ...state, historyIndex: -1 };
  }
}

function reduceCoreEvent(state: UiState, event: CoreEvent): UiState {
  switch (event.type) {
    case "task.started":
      return {
        ...state,
        status: "running",
        currentTaskId: event.taskId ?? state.currentTaskId,
        messages: ensureStreamingMessage(state.messages, event.taskId),
      };
    case "task.completed":
      return { ...state, status: "ready", currentTaskId: null, messages: finalizeStreaming(state.messages) };
    case "task.failed":
      return { ...state, status: "error", currentTaskId: null, messages: finalizeStreaming(state.messages) };
    case "task.interrupted":
      return { ...state, status: "ready", currentTaskId: null, messages: finalizeStreaming(state.messages) };
    case "message.delta":
      return { ...state, messages: appendDelta(state.messages, event.payload) };
    case "message.completed":
      return { ...state, messages: finalizeStreaming(state.messages) };
    case "approval.requested": {
      const approval = event.payload as ApprovalInfo;
      return {
        ...state,
        status: "waiting_approval",
        pendingApprovals: [...state.pendingApprovals, approval],
        approvalModalOpen: true,
      };
    }
    case "approval.resolved": {
      const resolved = event.payload as ApprovalInfo;
      const pending = state.pendingApprovals.filter((a) => a.id !== resolved.id);
      return { ...state, status: "running", pendingApprovals: pending, approvalModalOpen: pending.length > 0 };
    }
    case "core.error":
      return { ...state, status: "error", error: String((event.payload as { message?: unknown })?.message ?? "core error") };
    default:
      return state;
  }
}

function messageToUi(message: MessageRecord): UiMessage {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    streaming: false,
  };
}

function ensureStreamingMessage(messages: UiMessage[], taskId: string | undefined): UiMessage[] {
  if (messages.some((m) => m.streaming)) return messages;
  const id = `stream-${taskId ?? "task"}`;
  return [...messages, { id, role: "assistant", content: "", streaming: true }];
}

function appendDelta(messages: UiMessage[], payload: unknown): UiMessage[] {
  const delta = (payload as { delta?: unknown })?.delta;
  if (typeof delta !== "string") return messages;
  const idx = lastStreamingIndex(messages);
  if (idx < 0) return messages;
  const next = [...messages];
  next[idx] = { ...next[idx], content: next[idx].content + delta };
  return next;
}

function finalizeStreaming(messages: UiMessage[]): UiMessage[] {
  const idx = lastStreamingIndex(messages);
  if (idx < 0) return messages;
  const next = [...messages];
  next[idx] = { ...next[idx], streaming: false };
  return next;
}

function lastStreamingIndex(messages: UiMessage[]): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].streaming) return i;
  }
  return -1;
}

/** Pure streaming merge for unit testing (single assistant message from deltas). */
export function mergeStreamingDeltas(deltas: string[]): string {
  return deltas.join("");
}
