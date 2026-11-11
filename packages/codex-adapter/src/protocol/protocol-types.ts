/**
 * Minimal typed views of the Codex App Server protocol payloads Dicode uses.
 * These mirror the generated schema (schemas/codex-app-server) and are kept
 * intentionally loose on the fields Dicode does not consume, so a forward
 * protocol addition does not break the adapter.
 */

export type TurnStatus = "completed" | "interrupted" | "failed" | "inProgress";

export interface ProtocolTurn {
  id: string;
  status: TurnStatus;
  items?: unknown[];
  startedAt?: number | null;
  completedAt?: number | null;
  error?: { message: string } | null;
  rootTurnId?: string | null;
}

export interface ProtocolThread {
  id: string;
  [key: string]: unknown;
}

export interface ThreadResult {
  thread: ProtocolThread;
  cwd?: string | null;
  model?: string | null;
  modelProvider?: string | null;
  sandbox?: string | null;
}

export interface TurnResult {
  turn: ProtocolTurn;
}

export interface TextUserInput {
  type: "text";
  text: string;
}

export interface StartThreadParams {
  cwd?: string;
  model?: string;
  modelProvider?: string;
  sandbox?: "read-only" | "workspace-write" | "danger-full-access";
  developerInstructions?: string;
}

export interface ResumeThreadParams {
  threadId: string;
  cwd?: string;
  model?: string;
  developerInstructions?: string;
}

export interface StartTurnParams {
  threadId: string;
  input: TextUserInput[];
  model?: string;
  effort?: string;
  approvalPolicy?: "untrusted" | "on-request" | "never" | { granular: Record<string, boolean> };
  sandboxPolicy?: { type: "dangerFullAccess" };
  collaborationMode?: {
    mode: "default" | "plan";
    settings: {
      model: string;
      reasoning_effort: string | null;
      developer_instructions: null;
    };
  };
}

export interface SteerTurnParams {
  threadId: string;
  expectedTurnId: string;
  input: TextUserInput[];
}

export interface InterruptTurnParams {
  threadId: string;
  turnId: string;
}

export interface ModelReasoningEffort {
  reasoningEffort: string;
  description?: string;
}

export interface ModelInfo {
  id: string;
  model: string;
  displayName?: string;
  description?: string;
  hidden?: boolean;
  isDefault?: boolean;
  defaultReasoningEffort?: string;
  supportedReasoningEfforts?: ModelReasoningEffort[];
}

export interface ModelListResult {
  data: ModelInfo[];
  nextCursor?: string | null;
}
