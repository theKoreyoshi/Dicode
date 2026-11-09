import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  CodexClient,
  type DicodeEvent,
  type ThreadInfo,
  type TurnInfo,
} from "@dicode/codex-adapter";

const TASK = process.env.DICODE_TEST_TASK ?? "Reply with exactly this text and nothing else: DICODE_INTEGRATION_OK";
const TURN_TIMEOUT_MS = Number(process.env.DICODE_TEST_TIMEOUT_MS ?? 180_000);

describe("Codex Adapter integration (real App Server)", () => {
  let client: CodexClient;
  let workDir: string;
  let thread: ThreadInfo;
  const events: DicodeEvent[] = [];

  beforeAll(async () => {
    workDir = await mkdtemp(join(tmpdir(), "dicode-it-"));
    client = new CodexClient();
    client.onEvent((event) => {
      events.push(event);
      if (event.type !== "agent.message.delta" && event.type !== "reasoning.delta" && event.type !== "shell.output") {
        console.log(`[event] ${event.type} turn=${event.turnId ?? "-"} item=${event.itemId ?? "-"}`);
      }
    });
    await client.start();
  }, 60_000);

  afterAll(async () => {
    await client.stop();
    await rm(workDir, { recursive: true, force: true });
  }, 30_000);

  it("reaches ready and exposes capabilities", () => {
    expect(client.getStatus()).toBe("ready");
    const caps = client.getCapabilities();
    expect(caps.initialized).toBe(true);
    expect(caps.platformFamily).toBe("windows");
    console.log(`[ready] codexHome=${caps.codexHome} userAgent=${caps.userAgent}`);
  });

  it("lists models", async () => {
    await expect(client.healthCheck()).resolves.toBeUndefined();
  });

  it("creates a thread", async () => {
    thread = await client.createThread({ cwd: workDir });
    expect(thread.id).toBeTruthy();
    console.log(`[thread] id=${thread.id} cwd=${thread.cwd}`);
  });

  it("runs a turn with streaming output", async () => {
    const deltas: string[] = [];
    const turnCompleted = waitForEvent(client, "turn.completed", TURN_TIMEOUT_MS);

    const turn: TurnInfo = await client.startTurn(thread.id, { text: TASK });
    expect(turn.status).toBe("inProgress");
    console.log(`[turn] started id=${turn.id}`);

    const unsubscribe = client.onEvent((event) => {
      if (event.type === "agent.message.delta") {
        const delta = (event.payload as { delta?: unknown }).delta;
        if (typeof delta === "string") {
          deltas.push(delta);
          process.stdout.write(delta);
        }
      }
    });

    const completed = await turnCompleted;
    unsubscribe();
    process.stdout.write("\n");

    const text = deltas.join("");
    expect(completed).toBeTruthy();
    expect(text.length).toBeGreaterThan(0);
    console.log(`\n[turn] completed id=${turn.id} textLen=${text.length}`);
  }, TURN_TIMEOUT_MS + 30_000);

  it("resumes the thread", async () => {
    const resumed = await client.resumeThread(thread.id, { cwd: workDir });
    expect(resumed.id).toBe(thread.id);
    console.log(`[resume] ok id=${resumed.id}`);
  });

  it("handles a command approval and interrupt in a live turn", async () => {
    const approvalThread = await client.createThread({ cwd: workDir });
    let approved = false;

    // Test-only auto-approval to exercise the approval API. Production code
    // never auto-approves; this is the integration harness acting as the user.
    const offApproval = client.approvalManager.onApproval(async (request) => {
      if (request.type === "command") {
        approved = true;
        console.log(`[approval] command request received: ${JSON.stringify((request.params as Record<string, unknown>).command)}`);
        await client.approvalManager.respond(String(request.id), { kind: "approve" });
      }
    });

    const turn = await client.startTurn(approvalThread.id, {
      text: "Run this shell command and report its final output: ping -n 6 127.0.0.1",
    });
    console.log(`[turn] started id=${turn.id}`);

    // Interrupt after the agent has had time to start executing.
    await sleep(2500);
    let interrupted = false;
    try {
      await client.interruptTurn(approvalThread.id);
      interrupted = true;
      console.log("[interrupt] requested");
    } catch (error) {
      console.log(`[interrupt] not active: ${(error as Error).message}`);
    }

    const done = await waitForEvent(client, "turn.completed", 60_000).catch(() => null);
    offApproval();
    expect(done).toBeTruthy();
    console.log(`[turn] ended approved=${approved} interrupted=${interrupted}`);
  }, 120_000);
});

function waitForEvent(client: CodexClient, type: DicodeEvent["type"], timeoutMs: number): Promise<DicodeEvent> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      unsubscribe();
      reject(new Error(`timed out waiting for event ${type}`));
    }, timeoutMs);
    const unsubscribe = client.onEvent((event) => {
      if (event.type === type) {
        clearTimeout(timer);
        unsubscribe();
        resolve(event);
      }
    });
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
