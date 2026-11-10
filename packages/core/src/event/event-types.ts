export type CoreEventType =
  | "session.created"
  | "session.updated"
  | "session.archived"
  | "session.deleted"
  | "task.created"
  | "task.started"
  | "task.updated"
  | "task.completed"
  | "task.failed"
  | "task.interrupted"
  | "message.started"
  | "message.submitted"
  | "message.delta"
  | "message.completed"
  | "tool.started"
  | "tool.output"
  | "tool.completed"
  | "tool.failed"
  | "approval.requested"
  | "approval.resolved"
  | "file.changed"
  | "diff.updated"
  | "token.usage"
  | "project.opened"
  | "project.closed"
  | "runtime.connected"
  | "runtime.disconnected"
  | "core.error";

export interface CoreEvent<T = unknown> {
  id: string;
  type: CoreEventType;
  sessionId?: string;
  taskId?: string;
  turnId?: string;
  itemId?: string;
  sequence: number;
  timestamp: number;
  payload: T;
}
