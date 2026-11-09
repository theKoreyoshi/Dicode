export interface ThreadInfo {
  id: string;
  title?: string;
  preview?: string;
  cwd?: string | null;
  model?: string | null;
  modelProvider?: string | null;
  status?: unknown;
  createdAt?: number | null;
  updatedAt?: number | null;
}

export type SandboxMode = "read-only" | "workspace-write" | "danger-full-access";

export interface StartThreadOptions {
  cwd?: string;
  model?: string;
  modelProvider?: string;
  sandbox?: SandboxMode;
}

export interface ResumeThreadOptions {
  cwd?: string;
  model?: string;
}

export interface ListThreadOptions {
  limit?: number;
  cwd?: string;
  archived?: boolean;
  searchTerm?: string;
}

export interface ForkThreadOptions {
  cwd?: string;
  model?: string;
}
