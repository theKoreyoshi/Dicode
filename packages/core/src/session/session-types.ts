import type { SessionRecord, SessionStatus } from "../storage/storage-types.js";

export type { SessionStatus };

/** Public session view (same shape as the persisted record). */
export type SessionInfo = SessionRecord;

export interface CreateSessionOptions {
  projectPath: string;
  cwd?: string;
  model?: string;
  title?: string;
  metadata?: Record<string, unknown>;
}

export interface ListSessionsOptions {
  projectPath?: string;
  archived?: boolean;
  limit?: number;
}
