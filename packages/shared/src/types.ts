/**
 * Dicode-internal event types. The TUI consumes only these events; it never
 * touches raw JSON-RPC payloads from the Codex App Server.
 */
export type DicodeEventType =
  | "session.created"
  | "session.resumed"
  | "session.archived"
  | "turn.started"
  | "turn.completed"
  | "turn.interrupted"
  | "turn.failed"
  | "item.started"
  | "item.completed"
  | "agent.message.delta"
  | "reasoning.delta"
  | "tool.started"
  | "tool.completed"
  | "shell.started"
  | "shell.output"
  | "shell.completed"
  | "file.changed"
  | "approval.requested"
  | "approval.resolved"
  | "diff.updated"
  | "token.usage"
  | "agent.error"
  | "connection.status"
  | "unknown";

export interface DicodeEvent {
  /** Monotonic identifier assigned by the adapter, unique within a run. */
  id: string;
  type: DicodeEventType;
  sessionId?: string;
  turnId?: string;
  itemId?: string;
  timestamp: number;
  payload: unknown;
}

export interface DicodeSessionSummary {
  id: string;
  title: string;
  cwd?: string;
  model?: string;
  modelProvider?: string;
  createdAt?: number;
  updatedAt?: number;
}
