import type { Database } from "./database.js";
import type {
  ApprovalRecord,
  EventRecord,
  MessageRecord,
  ProjectRecord,
  SessionRecord,
  TaskRecord,
  ToolExecutionRecord,
} from "./storage-types.js";

function parseJson<T>(text: string | null | undefined, fallback: T): T {
  if (!text) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

export class ProjectRepository {
  constructor(private readonly db: Database) {}

  upsert(record: ProjectRecord): void {
    this.db
      .prepare(
        `INSERT INTO projects (id, name, path, git_root, is_git_repository, created_at, last_opened_at, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(path) DO UPDATE SET
           name = excluded.name,
           git_root = excluded.git_root,
           is_git_repository = excluded.is_git_repository,
           last_opened_at = excluded.last_opened_at,
           metadata = excluded.metadata`,
      )
      .run(
        record.id,
        record.name,
        record.path,
        record.gitRoot,
        record.isGitRepository ? 1 : 0,
        record.createdAt,
        record.lastOpenedAt,
        JSON.stringify(record.metadata),
      );
  }

  findByPath(path: string): ProjectRecord | null {
    const row = this.db.prepare("SELECT * FROM projects WHERE path = ?").get(path) as Row | undefined;
    return row ? mapProject(row) : null;
  }

  list(): ProjectRecord[] {
    const rows = this.db.prepare("SELECT * FROM projects ORDER BY last_opened_at DESC").all() as Row[];
    return rows.map(mapProject);
  }
}

export class SessionRepository {
  constructor(private readonly db: Database) {}

  insert(record: SessionRecord): void {
    this.db
      .prepare(
        `INSERT INTO sessions (id, codex_thread_id, project_path, title, cwd, model, status, created_at, updated_at, last_activity_at, archived, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        record.id,
        record.codexThreadId,
        record.projectPath,
        record.title,
        record.cwd,
        record.model,
        record.status,
        record.createdAt,
        record.updatedAt,
        record.lastActivityAt,
        record.archived ? 1 : 0,
        JSON.stringify(record.metadata),
      );
  }

  update(record: SessionRecord): void {
    this.db
      .prepare(
        `UPDATE sessions SET title = ?, cwd = ?, model = ?, status = ?, updated_at = ?, last_activity_at = ?, archived = ?, metadata = ?
         WHERE id = ?`,
      )
      .run(
        record.title,
        record.cwd,
        record.model,
        record.status,
        record.updatedAt,
        record.lastActivityAt,
        record.archived ? 1 : 0,
        JSON.stringify(record.metadata),
        record.id,
      );
  }

  get(id: string): SessionRecord | null {
    const row = this.db.prepare("SELECT * FROM sessions WHERE id = ?").get(id) as Row | undefined;
    return row ? mapSession(row) : null;
  }

  list(options: { projectPath?: string; archived?: boolean } = {}): SessionRecord[] {
    const clauses: string[] = [];
    const params: Array<string | number | null> = [];
    if (options.projectPath) {
      clauses.push("project_path = ?");
      params.push(options.projectPath);
    }
    if (options.archived !== undefined) {
      clauses.push("archived = ?");
      params.push(options.archived ? 1 : 0);
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const rows = this.db
      .prepare(`SELECT * FROM sessions ${where} ORDER BY last_activity_at DESC`)
      .all(...params) as Row[];
    return rows.map(mapSession);
  }

  delete(id: string): void {
    this.db.prepare("DELETE FROM sessions WHERE id = ?").run(id);
  }
}

export class TaskRepository {
  constructor(private readonly db: Database) {}

  insert(record: TaskRecord): void {
    this.db
      .prepare(
        `INSERT INTO tasks (id, session_id, turn_id, status, input_text, error, created_at, started_at, completed_at, duration_ms)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        record.id,
        record.sessionId,
        record.turnId,
        record.status,
        record.inputText,
        record.error,
        record.createdAt,
        record.startedAt,
        record.completedAt,
        record.durationMs,
      );
  }

  update(record: TaskRecord): void {
    this.db
      .prepare(
        `UPDATE tasks SET turn_id = ?, status = ?, error = ?, started_at = ?, completed_at = ?, duration_ms = ?
         WHERE id = ?`,
      )
      .run(
        record.turnId,
        record.status,
        record.error,
        record.startedAt,
        record.completedAt,
        record.durationMs,
        record.id,
      );
  }

  get(id: string): TaskRecord | null {
    const row = this.db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as Row | undefined;
    return row ? mapTask(row) : null;
  }

  getByTurnId(turnId: string): TaskRecord | null {
    const row = this.db.prepare("SELECT * FROM tasks WHERE turn_id = ?").get(turnId) as Row | undefined;
    return row ? mapTask(row) : null;
  }

  listBySession(sessionId: string): TaskRecord[] {
    const rows = this.db.prepare("SELECT * FROM tasks WHERE session_id = ? ORDER BY created_at ASC").all(sessionId) as Row[];
    return rows.map(mapTask);
  }

  getRunningBySession(sessionId: string): TaskRecord | null {
    const row = this.db
      .prepare("SELECT * FROM tasks WHERE session_id = ? AND status IN ('queued','running','waiting_approval') ORDER BY created_at DESC LIMIT 1")
      .get(sessionId) as Row | undefined;
    return row ? mapTask(row) : null;
  }
}

export class MessageRepository {
  constructor(private readonly db: Database) {}

  insert(record: MessageRecord): void {
    this.db
      .prepare(
        `INSERT INTO messages (id, session_id, task_id, turn_id, item_id, role, content, sequence, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        record.id,
        record.sessionId,
        record.taskId,
        record.turnId,
        record.itemId,
        record.role,
        record.content,
        record.sequence,
        record.createdAt,
      );
  }

  listBySession(sessionId: string, limit = 200): MessageRecord[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM messages WHERE session_id = ? ORDER BY sequence ASC LIMIT ?`,
      )
      .all(sessionId, limit) as Row[];
    return rows.map(mapMessage);
  }

  maxSequence(sessionId: string): number {
    const row = this.db
      .prepare("SELECT COALESCE(MAX(sequence), 0) AS m FROM messages WHERE session_id = ?")
      .get(sessionId) as { m: number } | undefined;
    return row?.m ?? 0;
  }
}

export class EventRepository {
  constructor(private readonly db: Database) {}

  insert(record: EventRecord): void {
    this.db
      .prepare(
        `INSERT INTO events (id, session_id, task_id, turn_id, item_id, type, payload, sequence, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        record.id,
        record.sessionId,
        record.taskId,
        record.turnId,
        record.itemId,
        record.type,
        JSON.stringify(record.payload),
        record.sequence,
        record.createdAt,
      );
  }

  listBySession(sessionId: string, limit = 500): EventRecord[] {
    const rows = this.db
      .prepare(`SELECT * FROM events WHERE session_id = ? ORDER BY sequence ASC LIMIT ?`)
      .all(sessionId, limit) as Row[];
    return rows.map(mapEvent);
  }
}

export class ApprovalRepository {
  constructor(private readonly db: Database) {}

  insert(record: ApprovalRecord): void {
    this.db
      .prepare(
        `INSERT INTO approvals (id, session_id, task_id, codex_request_id, type, title, description, status, metadata, created_at, resolved_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        record.id,
        record.sessionId,
        record.taskId,
        record.codexRequestId,
        record.type,
        record.title,
        record.description,
        record.status,
        JSON.stringify(record.metadata),
        record.createdAt,
        record.resolvedAt,
      );
  }

  update(record: ApprovalRecord): void {
    this.db
      .prepare(
        `UPDATE approvals SET status = ?, metadata = ?, resolved_at = ? WHERE id = ?`,
      )
      .run(record.status, JSON.stringify(record.metadata), record.resolvedAt, record.id);
  }

  get(id: string): ApprovalRecord | null {
    const row = this.db.prepare("SELECT * FROM approvals WHERE id = ?").get(id) as Row | undefined;
    return row ? mapApproval(row) : null;
  }

  listBySession(sessionId: string, status?: string): ApprovalRecord[] {
    const rows = status
      ? (this.db.prepare("SELECT * FROM approvals WHERE session_id = ? AND status = ? ORDER BY created_at DESC").all(sessionId, status) as Row[])
      : (this.db.prepare("SELECT * FROM approvals WHERE session_id = ? ORDER BY created_at DESC").all(sessionId) as Row[]);
    return rows.map(mapApproval);
  }

  listPending(): ApprovalRecord[] {
    const rows = this.db.prepare("SELECT * FROM approvals WHERE status = 'pending' ORDER BY created_at ASC").all() as Row[];
    return rows.map(mapApproval);
  }
}

export class ToolExecutionRepository {
  constructor(private readonly db: Database) {}

  insert(record: ToolExecutionRecord): void {
    this.db
      .prepare(
        `INSERT INTO tool_executions (id, session_id, task_id, turn_id, item_id, tool_name, tool_type, status, input, output, duration_ms, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        record.id,
        record.sessionId,
        record.taskId,
        record.turnId,
        record.itemId,
        record.toolName,
        record.toolType,
        record.status,
        JSON.stringify(record.input),
        record.output,
        record.durationMs,
        record.createdAt,
      );
  }

  update(record: ToolExecutionRecord): void {
    this.db
      .prepare(`UPDATE tool_executions SET status = ?, output = ?, duration_ms = ? WHERE id = ?`)
      .run(record.status, record.output, record.durationMs, record.id);
  }

  getByItemId(itemId: string): ToolExecutionRecord | null {
    const row = this.db.prepare("SELECT * FROM tool_executions WHERE item_id = ?").get(itemId) as Row | undefined;
    return row ? mapToolExecution(row) : null;
  }

  listBySession(sessionId: string, limit = 200): ToolExecutionRecord[] {
    const rows = this.db
      .prepare("SELECT * FROM tool_executions WHERE session_id = ? ORDER BY created_at ASC LIMIT ?")
      .all(sessionId, limit) as Row[];
    return rows.map(mapToolExecution);
  }
}

type Row = Record<string, unknown>;

function str(row: Row, key: string): string {
  return String(row[key] ?? "");
}

function num(row: Row, key: string): number {
  return Number(row[key] ?? 0);
}

function nullableStr(row: Row, key: string): string | null {
  const v = row[key];
  return v == null ? null : String(v);
}

function nullableNum(row: Row, key: string): number | null {
  const v = row[key];
  return v == null ? null : Number(v);
}

function mapProject(row: Row): ProjectRecord {
  return {
    id: str(row, "id"),
    name: str(row, "name"),
    path: str(row, "path"),
    gitRoot: nullableStr(row, "git_root"),
    isGitRepository: num(row, "is_git_repository") === 1,
    createdAt: num(row, "created_at"),
    lastOpenedAt: num(row, "last_opened_at"),
    metadata: parseJson(str(row, "metadata"), {}),
  };
}

function mapSession(row: Row): SessionRecord {
  return {
    id: str(row, "id"),
    codexThreadId: str(row, "codex_thread_id"),
    projectPath: str(row, "project_path"),
    title: str(row, "title"),
    cwd: str(row, "cwd"),
    model: nullableStr(row, "model"),
    status: str(row, "status") as SessionRecord["status"],
    createdAt: num(row, "created_at"),
    updatedAt: num(row, "updated_at"),
    lastActivityAt: num(row, "last_activity_at"),
    archived: num(row, "archived") === 1,
    metadata: parseJson(str(row, "metadata"), {}),
  };
}

function mapTask(row: Row): TaskRecord {
  return {
    id: str(row, "id"),
    sessionId: str(row, "session_id"),
    turnId: nullableStr(row, "turn_id"),
    status: str(row, "status") as TaskRecord["status"],
    inputText: str(row, "input_text"),
    error: nullableStr(row, "error"),
    createdAt: num(row, "created_at"),
    startedAt: nullableNum(row, "started_at"),
    completedAt: nullableNum(row, "completed_at"),
    durationMs: nullableNum(row, "duration_ms"),
  };
}

function mapMessage(row: Row): MessageRecord {
  return {
    id: str(row, "id"),
    sessionId: str(row, "session_id"),
    taskId: nullableStr(row, "task_id"),
    turnId: nullableStr(row, "turn_id"),
    itemId: nullableStr(row, "item_id"),
    role: str(row, "role") as MessageRecord["role"],
    content: str(row, "content"),
    sequence: num(row, "sequence"),
    createdAt: num(row, "created_at"),
  };
}

function mapEvent(row: Row): EventRecord {
  return {
    id: str(row, "id"),
    sessionId: nullableStr(row, "session_id"),
    taskId: nullableStr(row, "task_id"),
    turnId: nullableStr(row, "turn_id"),
    itemId: nullableStr(row, "item_id"),
    type: str(row, "type"),
    payload: parseJson(str(row, "payload"), {}),
    sequence: num(row, "sequence"),
    createdAt: num(row, "created_at"),
  };
}

function mapApproval(row: Row): ApprovalRecord {
  return {
    id: str(row, "id"),
    sessionId: str(row, "session_id"),
    taskId: nullableStr(row, "task_id"),
    codexRequestId: str(row, "codex_request_id"),
    type: str(row, "type"),
    title: str(row, "title"),
    description: nullableStr(row, "description"),
    status: str(row, "status") as ApprovalRecord["status"],
    metadata: parseJson(str(row, "metadata"), {}),
    createdAt: num(row, "created_at"),
    resolvedAt: nullableNum(row, "resolved_at"),
  };
}

function mapToolExecution(row: Row): ToolExecutionRecord {
  return {
    id: str(row, "id"),
    sessionId: str(row, "session_id"),
    taskId: nullableStr(row, "task_id"),
    turnId: nullableStr(row, "turn_id"),
    itemId: nullableStr(row, "item_id"),
    toolName: str(row, "tool_name"),
    toolType: str(row, "tool_type"),
    status: str(row, "status") as ToolExecutionRecord["status"],
    input: parseJson(str(row, "input"), {}),
    output: nullableStr(row, "output"),
    durationMs: nullableNum(row, "duration_ms"),
    createdAt: num(row, "created_at"),
  };
}
