import { describe, expect, it } from "vitest";
import { Database, SessionRepository, TaskRepository, MessageRepository } from "@dicode/core";
import { createId } from "@dicode/core";
import { nowMs } from "@dicode/core";

function db(): Database {
  return new Database({ path: ":memory:" });
}

describe("Storage (SQLite)", () => {
  it("runs migrations and creates the schema", () => {
    const database = db();
    const tables = database.db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all() as Array<{ name: string }>;
    const names = tables.map((t) => t.name);
    for (const expected of ["sessions", "tasks", "messages", "events", "approvals", "projects", "tool_executions", "schema_migrations"]) {
      expect(names).toContain(expected);
    }
    database.close();
  });

  it("persists and reloads a session", () => {
    const database = db();
    const repo = new SessionRepository(database);
    const now = nowMs();
    repo.insert({
      id: "s1",
      codexThreadId: "th1",
      projectPath: "C:/proj",
      title: "hello",
      cwd: "C:/proj",
      model: null,
      status: "idle",
      createdAt: now,
      updatedAt: now,
      lastActivityAt: now,
      archived: false,
      metadata: { foo: "bar" },
    });
    const loaded = repo.get("s1");
    expect(loaded?.codexThreadId).toBe("th1");
    expect(loaded?.metadata).toEqual({ foo: "bar" });
    database.close();
  });

  it("cascades task/message lookup", () => {
    const database = db();
    const sessionRepo = new SessionRepository(database);
    const taskRepo = new TaskRepository(database);
    const msgRepo = new MessageRepository(database);
    const now = nowMs();

    sessionRepo.insert({
      id: "s1",
      codexThreadId: "th1",
      projectPath: "C:/proj",
      title: "t",
      cwd: "C:/proj",
      model: null,
      status: "idle",
      createdAt: now,
      updatedAt: now,
      lastActivityAt: now,
      archived: false,
      metadata: {},
    });
    taskRepo.insert({ id: "task1", sessionId: "s1", turnId: null, status: "queued", inputText: "hi", error: null, createdAt: now, startedAt: null, completedAt: null, durationMs: null });
    msgRepo.insert({ id: createId(), sessionId: "s1", taskId: "task1", turnId: null, itemId: null, role: "user", content: "hi", sequence: 1, createdAt: now });

    expect(taskRepo.getRunningBySession("s1")?.id).toBe("task1");
    expect(msgRepo.maxSequence("s1")).toBe(1);
    expect(msgRepo.listBySession("s1")).toHaveLength(1);
    database.close();
  });
});
