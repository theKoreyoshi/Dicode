import type { DicodeContext, ContextReference } from "./context-types.js";

export class ContextManager {
  private context: DicodeContext;

  constructor(initial: DicodeContext) {
    this.context = { ...initial, references: [...initial.references] };
  }

  get(): DicodeContext {
    return { ...this.context, references: [...this.context.references] };
  }

  setProject(projectPath: string, cwd?: string): void {
    this.context.projectPath = projectPath;
    if (cwd) this.context.cwd = cwd;
  }

  setSession(sessionId?: string): void {
    this.context.sessionId = sessionId;
  }

  setTask(taskId?: string): void {
    this.context.taskId = taskId;
  }

  setModel(model?: string): void {
    this.context.model = model;
  }

  updateCwd(cwd: string): void {
    this.context.cwd = cwd;
  }

  addReference(reference: ContextReference): void {
    this.context.references.push(reference);
  }

  clearReferences(): void {
    this.context.references = [];
  }
}
