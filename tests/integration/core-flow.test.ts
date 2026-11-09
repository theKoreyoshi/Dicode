import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDicodeCore, type CoreEvent, type DicodeCore } from "@dicode/core";

const TASK = process.env.DICODE_TEST_TASK ?? "Reply with exactly this text and nothing else: DICODE_CORE_OK";
const TURN_TIMEOUT_MS = Number(process.env.DICODE_TEST_TIMEOUT_MS ?? 180_000);

describe("Dicode Core integration (real App Server)", () => {
  let core: DicodeCore;
  let baseDir: string;
  let sessionId: string;
  const events: CoreEvent[] = [];

  beforeAll(async () => {
    baseDir = mkdtempSync(join(tmpdir(), "dicode-core-"));
    core = createDicodeCore({
      configDir: join(baseDir, "config"),
      dataDir: join(baseDir, "data"),
    });
    core.subscribe((event) => {
      events.push(event);
      if (!["message.delta", "tool.output"].includes(event.type)) {
        console.log(`[core-event] ${event.type} task=${event.taskId ?? "-"}`);
      }
    });
    await core.initialize();
  }, 60_000);

  afterAll(async () => {
    await core.shutdown();
    rmSync(baseDir, { recursive: true, force: true });
  }, 30_000);

  it("reaches ready and exposes capabilities", () => {
    expect(core.getStatus()).toBe("ready");
    const caps = core.getCapabilities();
    expect(caps.sessionCreate).toBe(true);
    expect(caps.taskStart).toBe(true);
    console.log(`[core] capabilities=${JSON.stringify(caps)}`);
  });

  it("opens a real project", () => {
    const project = core.openProject(process.cwd());
    expect(project.path).toBe(process.cwd());
    expect(project.isGitRepository).toBe(true);
    console.log(`[project] ${project.name} gitRoot=${project.gitRoot}`);
  });

  it("creates a session and runs a task", async () => {
    const session = await core.createSession({ projectPath: process.cwd() });
    sessionId = session.id;
    expect(session.codexThreadId).toBeTruthy();
    console.log(`[session] id=${session.id} thread=${session.codexThreadId}`);

    const deltas: string[] = [];
    const completed = waitForCoreEvent(core, "task.completed", TURN_TIMEOUT_MS);

    const task = await core.sendMessage(session.id, { text: TASK });
    expect(task.status).toBe("running");
    console.log(`[task] started id=${task.id} turn=${task.turnId}`);

    const off = core.subscribe((event) => {
      if (event.type === "message.delta") {
        const delta = (event.payload as { delta?: unknown }).delta;
        if (typeof delta === "string") {
          deltas.push(delta);
          process.stdout.write(delta);
        }
      }
    });

    await completed;
    off();
    process.stdout.write("\n");
    expect(deltas.join("").length).toBeGreaterThan(0);
    console.log(`[task] completed`);
  }, TURN_TIMEOUT_MS + 30_000);

  it("persists message history", () => {
    const messages = core.getMessages(sessionId);
    expect(messages.length).toBeGreaterThanOrEqual(2); // user + assistant
    const roles = new Set(messages.map((m) => m.role));
    expect(roles.has("user")).toBe(true);
    expect(roles.has("assistant")).toBe(true);
    console.log(`[messages] ${messages.length} persisted`);
  });

  it("persists tasks and tool executions", () => {
    const tasks = core.listTasksBySession(sessionId);
    expect(tasks.length).toBeGreaterThanOrEqual(1);
    expect(tasks[0].turnId).toBeTruthy();
  });

  it("shuts down and restarts to resume the session", async () => {
    await core.shutdown();

    core = createDicodeCore({ configDir: join(baseDir, "config"), dataDir: join(baseDir, "data") });
    await core.initialize();

    const sessions = core.listSessions();
    expect(sessions.length).toBeGreaterThanOrEqual(1);
    expect(sessions.some((s) => s.id === sessionId)).toBe(true);

    const resumed = await core.resumeSession(sessionId);
    expect(resumed.id).toBe(sessionId);
    const messages = core.getMessages(sessionId);
    expect(messages.length).toBeGreaterThanOrEqual(2);
    console.log(`[restart] resumed ${sessionId} with ${messages.length} messages`);
  }, 60_000);
});

function waitForCoreEvent(core: DicodeCore, type: CoreEvent["type"], timeoutMs: number): Promise<CoreEvent> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      unsubscribe();
      reject(new Error(`timed out waiting for core event ${type}`));
    }, timeoutMs);
    const unsubscribe = core.subscribe((event) => {
      if (event.type === type) {
        clearTimeout(timer);
        unsubscribe();
        resolve(event);
      }
    });
  });
}
