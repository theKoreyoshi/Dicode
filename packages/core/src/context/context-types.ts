export interface ContextReference {
  type: "file" | "directory" | "symbol" | "other";
  path: string;
  metadata?: Record<string, unknown>;
}

export interface DicodeContext {
  projectPath: string;
  cwd: string;
  sessionId?: string;
  taskId?: string;
  model?: string;
  references: ContextReference[];
  metadata: Record<string, unknown>;
}
