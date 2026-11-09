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
  | "agent.message.delta"
  | "item.started"
  | "item.completed"
  | "tool.call"
  | "tool.result"
  | "shell.output"
  | "file.read"
  | "file.changed"
  | "command.executed"
  | "approval.requested"
  | "approval.resolved"
  | "diff.updated"
  | "agent.error"
  | "connection.closed";

export interface DicodeEvent {
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
