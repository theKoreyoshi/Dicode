import type { TaskRecord, TaskStatus } from "../storage/storage-types.js";

export type { TaskStatus };

export type TaskInfo = TaskRecord;

export interface MessageInput {
  text: string;
  model?: string;
  effort?: string;
}
