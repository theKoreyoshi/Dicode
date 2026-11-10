export interface ProjectRecord {
  id: string;
  name: string;
  path: string;
  gitRoot: string | null;
  isGitRepository: boolean;
  createdAt: number;
  lastOpenedAt: number;
  metadata: Record<string, unknown>;
}

export type SessionStatus = "idle" | "running" | "waiting_approval" | "completed" | "failed" | "interrupted";

export interface SessionRecord {
  id: string;
  codexThreadId: string;
  projectPath: string;
  title: string;
  cwd: string;
  model: string | null;
  status: SessionStatus;
  createdAt: number;
  updatedAt: number;
  lastActivityAt: number;
  archived: boolean;
  metadata: Record<string, unknown>;
}

export type TaskStatus = "queued" | "running" | "waiting_approval" | "completed" | "failed" | "interrupted";

export interface TaskRecord {
  id: string;
  sessionId: string;
  turnId: string | null;
  status: TaskStatus;
  inputText: string;
  error: string | null;
  createdAt: number;
  startedAt: number | null;
  completedAt: number | null;
  durationMs: number | null;
  ownerPid?: number | null;
}

export type MessageRole = "user" | "assistant";
export type MessagePhase = "commentary" | "partial_answer" | "final_answer";

export interface MessageRecord {
  id: string;
  sessionId: string;
  taskId: string | null;
  turnId: string | null;
  itemId: string | null;
  role: MessageRole;
  content: string;
  phase?: MessagePhase;
  kind?: "plan";
  incomplete?: boolean;
  sequence: number;
  createdAt: number;
}

export interface EventRecord {
  id: string;
  sessionId: string | null;
  taskId: string | null;
  turnId: string | null;
  itemId: string | null;
  type: string;
  payload: Record<string, unknown>;
  sequence: number;
  createdAt: number;
}

export type ApprovalStatus = "pending" | "approved" | "rejected" | "expired" | "cancelled";

export interface ApprovalRecord {
  id: string;
  sessionId: string;
  taskId: string | null;
  codexRequestId: string;
  type: string;
  title: string;
  description: string | null;
  status: ApprovalStatus;
  metadata: Record<string, unknown>;
  createdAt: number;
  resolvedAt: number | null;
}

export type ToolExecutionStatus = "running" | "completed" | "failed";

export interface ToolExecutionRecord {
  id: string;
  sessionId: string;
  taskId: string | null;
  turnId: string | null;
  itemId: string | null;
  toolName: string;
  toolType: string;
  status: ToolExecutionStatus;
  input: Record<string, unknown>;
  output: string | null;
  durationMs: number | null;
  createdAt: number;
}
