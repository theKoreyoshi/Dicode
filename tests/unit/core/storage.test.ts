import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Database, EventRepository, SessionRepository, TaskRepository, MessageRepository } from "@dicode/core";
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

  it("recovers native message phases from pre-upgrade history without removing content", () => {
    const directory = mkdtempSync(join(tmpdir(), "dicode-message-migration-"));
    const path = join(directory, "dicode.db");
    const before = new Database({ path });
    try {
      new SessionRepository(before).insert({
        id: "s1", codexThreadId: "t1", projectPath: directory, cwd: directory, title: "Legacy", model: null,
        status: "completed", createdAt: 1, updatedAt: 1, lastActivityAt: 1, archived: false, metadata: {},
      });
      new MessageRepository(before).insert({
        id: "m1", sessionId: "s1", taskId: null, turnId: "turn1", itemId: "item1", role: "assistant",
        content: "A completed commentary", sequence: 1, createdAt: 1,
      });
      new EventRepository(before).insert({
        id: "e1", sessionId: "s1", taskId: null, turnId: "turn1", itemId: "item1", type: "message.completed",
        payload: { item: { type: "agentMessage", phase: "commentary" } }, sequence: 1, createdAt: 1,
      });
      before.exec(`
        ALTER TABLE messages DROP COLUMN phase;
        ALTER TABLE messages DROP COLUMN is_plan;
        ALTER TABLE messages DROP COLUMN incomplete;
        DELETE FROM schema_migrations WHERE version >= 3;
      `);
    } finally {
      before.close();
    }
    try {
      const after = new Database({ path });
      try {
        expect(new MessageRepository(after).listBySession("s1")).toMatchObject([{
          content: "A completed commentary", phase: "commentary",
        }]);
      } finally {
        after.close();
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("marks interrupted legacy answers as incomplete when upgrading an existing v3 database", () => {
    const directory = mkdtempSync(join(tmpdir(), "dicode-incomplete-migration-"));
    try {
      const path = join(directory, "dicode.db");
      const before = new Database({ path });
      try {
        new SessionRepository(before).insert({
          id: "s1", codexThreadId: "thread", projectPath: directory, cwd: directory, title: "Legacy", model: null,
          status: "interrupted", createdAt: 1, updatedAt: 1, lastActivityAt: 1, archived: false, metadata: {},
        });
        new TaskRepository(before).insert({
          id: "task1", sessionId: "s1", turnId: "turn1", status: "interrupted",
          inputText: "", error: null, createdAt: 1, startedAt: 1, completedAt: 2, durationMs: 1,
        });
        const messages = new MessageRepository(before);
        const answer = { sessionId: "s1", taskId: null, turnId: "turn1", itemId: null, role: "assistant" as const, createdAt: 2 };
        messages.insert({ ...answer, id: "draft", content: "Interrupted text", sequence: 1 });
        messages.insert({ ...answer, id: "final", content: "Completed answer", sequence: 2, phase: "final_answer" });
        before.exec("DELETE FROM schema_migrations WHERE version = 4");
      } finally {
        before.close();
      }
      const after = new Database({ path });
      try {
        const [draft, final] = new MessageRepository(after).listBySession("s1");
        expect(draft).toMatchObject({ content: "Interrupted text", incomplete: true });
        expect(final.phase).toBe("final_answer");
        expect(final.incomplete).toBeUndefined();
      } finally {
        after.close();
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
