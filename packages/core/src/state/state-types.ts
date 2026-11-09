import type { ApprovalInfo } from "../approval/approval-types.js";
import type { CoreCapabilities } from "../capability/capability-types.js";
import type { DicodeConfig } from "../config/config-types.js";
import type { ProjectInfo } from "../project/project-types.js";
import type { SessionInfo } from "../session/session-types.js";
import type { TaskInfo } from "../task/task-types.js";

export interface RuntimeState {
  status: "stopped" | "initializing" | "ready" | "shutting_down" | "failed";
  connected: boolean;
}

export interface ProjectState {
  currentProjectId: string | null;
  projects: ProjectInfo[];
}

export interface SessionState {
  currentSessionId: string | null;
  sessions: Record<string, SessionInfo>;
}

export interface TaskState {
  tasks: Record<string, TaskInfo>;
  runningBySession: Record<string, string>;
}

export interface ApprovalState {
  approvals: Record<string, ApprovalInfo>;
}

export interface DicodeState {
  runtime: RuntimeState;
  project: ProjectState;
  sessions: SessionState;
  tasks: TaskState;
  approvals: ApprovalState;
  capabilities: CoreCapabilities;
  config: DicodeConfig;
}
