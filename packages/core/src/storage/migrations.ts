export interface Migration {
  version: number;
  sql: string;
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        path TEXT NOT NULL UNIQUE,
        git_root TEXT,
        is_git_repository INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        last_opened_at INTEGER NOT NULL,
        metadata TEXT NOT NULL DEFAULT '{}'
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        codex_thread_id TEXT NOT NULL,
        project_path TEXT NOT NULL,
        title TEXT NOT NULL DEFAULT '',
        cwd TEXT NOT NULL,
        model TEXT,
        status TEXT NOT NULL DEFAULT 'idle',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        last_activity_at INTEGER NOT NULL,
        archived INTEGER NOT NULL DEFAULT 0,
        metadata TEXT NOT NULL DEFAULT '{}'
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_path);
      CREATE INDEX IF NOT EXISTS idx_sessions_last_activity ON sessions(last_activity_at DESC);
      CREATE INDEX IF NOT EXISTS idx_sessions_archived ON sessions(archived);

      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        turn_id TEXT,
        status TEXT NOT NULL DEFAULT 'queued',
        input_text TEXT NOT NULL DEFAULT '',
        error TEXT,
        created_at INTEGER NOT NULL,
        started_at INTEGER,
        completed_at INTEGER,
        duration_ms INTEGER,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_tasks_session ON tasks(session_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_turn ON tasks(turn_id);

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        task_id TEXT,
        turn_id TEXT,
        item_id TEXT,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        sequence INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, sequence);
      CREATE INDEX IF NOT EXISTS idx_messages_task ON messages(task_id);

      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        session_id TEXT,
        task_id TEXT,
        turn_id TEXT,
        item_id TEXT,
        type TEXT NOT NULL,
        payload TEXT NOT NULL DEFAULT '{}',
        sequence INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id, sequence);
      CREATE INDEX IF NOT EXISTS idx_events_turn ON events(turn_id);

      CREATE TABLE IF NOT EXISTS approvals (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        task_id TEXT,
        codex_request_id TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL DEFAULT '',
        description TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        metadata TEXT NOT NULL DEFAULT '{}',
        created_at INTEGER NOT NULL,
        resolved_at INTEGER,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_approvals_session ON approvals(session_id);
      CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status);

      CREATE TABLE IF NOT EXISTS tool_executions (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        task_id TEXT,
        turn_id TEXT,
        item_id TEXT,
        tool_name TEXT NOT NULL,
        tool_type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'running',
        input TEXT NOT NULL DEFAULT '{}',
        output TEXT,
        duration_ms INTEGER,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_tool_executions_session ON tool_executions(session_id);
      CREATE INDEX IF NOT EXISTS idx_tool_executions_turn ON tool_executions(turn_id);
    `,
  },
  {
    version: 2,
    sql: `
      ALTER TABLE tasks ADD COLUMN owner_pid INTEGER;
      CREATE INDEX IF NOT EXISTS idx_sessions_codex_thread ON sessions(codex_thread_id);
      CREATE INDEX IF NOT EXISTS idx_events_session_type ON events(session_id, type, created_at DESC);
    `,
  },
  {
    version: 3,
    sql: `
      ALTER TABLE messages ADD COLUMN phase TEXT;
      ALTER TABLE messages ADD COLUMN is_plan INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE messages ADD COLUMN incomplete INTEGER NOT NULL DEFAULT 0;

      UPDATE messages AS message
      SET phase = json_extract(event.payload, '$.item.phase'),
          is_plan = CASE WHEN json_extract(event.payload, '$.item.type') = 'plan' THEN 1 ELSE 0 END
      FROM events AS event
      WHERE event.type = 'message.completed'
        AND message.role = 'assistant'
        AND event.session_id = message.session_id
        AND event.item_id = message.item_id
        AND json_valid(event.payload);
    `,
  },
  {
    version: 4,
    sql: `
      UPDATE messages AS message
      SET incomplete = 1
      WHERE message.role = 'assistant'
        AND message.phase IS NULL
        AND message.is_plan = 0
        AND message.incomplete = 0
        AND EXISTS (
          SELECT 1 FROM tasks AS task
          WHERE task.session_id = message.session_id
            AND task.status IN ('failed', 'interrupted')
            AND (task.id = message.task_id OR (message.task_id IS NULL AND task.turn_id = message.turn_id))
        );
    `,
  },
];
