import { createRequire } from "node:module";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { StorageError } from "../errors/core-errors.js";
import { nowMs } from "../utils/time.js";
import { MIGRATIONS } from "./migrations.js";

// `node:sqlite` is a Node built-in added after Vite's known-builtins list, so
// we load it through a runtime require to keep it out of Vite's static graph.
const require = createRequire(import.meta.url);
const nodeSqlite = require("node:sqlite") as typeof import("node:sqlite");

type SqliteDatabase = InstanceType<typeof nodeSqlite.DatabaseSync>;

export interface DatabaseOptions {
  path: string;
}

export class Database {
  readonly db: SqliteDatabase;

  constructor(options: DatabaseOptions) {
    try {
      if (options.path !== ":memory:") {
        mkdirSync(dirname(options.path), { recursive: true });
      }
      this.db = new nodeSqlite.DatabaseSync(options.path);
      this.db.exec("PRAGMA journal_mode = WAL;");
      this.db.exec("PRAGMA foreign_keys = ON;");
      this.migrate();
    } catch (error) {
      throw new StorageError("failed to open database", { cause: error });
    }
  }

  exec(sql: string): void {
    this.db.exec(sql);
  }

  prepare(sql: string) {
    return this.db.prepare(sql);
  }

  transaction<T>(fn: () => T): T {
    this.db.exec("BEGIN");
    try {
      const result = fn();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  close(): void {
    this.db.close();
  }

  private migrate(): void {
    this.db.exec(
      "CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL)",
    );
    const applied = new Set(
      (this.db.prepare("SELECT version FROM schema_migrations").all() as Array<{ version: number }>).map(
        (row) => row.version,
      ),
    );

    const insert = this.db.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)");
    for (const migration of MIGRATIONS) {
      if (applied.has(migration.version)) continue;
      this.db.exec("BEGIN");
      try {
        this.db.exec(migration.sql);
        insert.run(migration.version, nowMs());
        this.db.exec("COMMIT");
      } catch (error) {
        this.db.exec("ROLLBACK");
        throw new StorageError(`migration v${migration.version} failed`, { cause: error });
      }
    }
  }
}

export function ensureDatabaseFile(path: string): void {
  if (!existsSync(path)) {
    mkdirSync(dirname(path), { recursive: true });
  }
}
