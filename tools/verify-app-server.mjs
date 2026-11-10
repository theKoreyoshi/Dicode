#!/usr/bin/env node
// Phase 1 technical validation: verify JSON-RPC over stdio against the real
// Codex App Server. This is a throwaway diagnostic, not the production adapter.

import { spawn } from "node:child_process";
import { join } from "node:path";
import readline from "node:readline";

const CODEX_EXE = process.env.DICODE_CODEX_EXE ??
  "C:\\Users\\29234\\AppData\\Local\\OpenAI\\Codex\\bin\\f71a721e0e6193a9\\codex.exe";
const HOME = process.env.USERPROFILE;
const CODEX_HOME = process.env.DICODE_CODEX_HOME ?? join(HOME, ".codex");

const TIMEOUT_MS = Number(process.env.DICODE_RPC_TIMEOUT_MS ?? 15000);

function log(...args) {
  console.error("[dicode-verify]", ...args);
}

const child = spawn(CODEX_EXE, ["app-server", "--listen", "stdio://"], {
  env: { ...process.env, HOME, CODEX_HOME },
  stdio: ["pipe", "pipe", "pipe"],
  windowsHide: true,
});

let nextId = 1;
const pending = new Map();
let stderrSeen = false;

const rl = readline.createInterface({ input: child.stdout });

rl.on("line", (raw) => {
  const line = raw.trim();
  if (!line) return;
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    log("NON-JSON on protocol stdout");
    return;
  }

  // Server request (e.g. approval prompts / elicitation).
  if (msg.id !== undefined && msg.method !== undefined) {
    log("SERVER-REQUEST method=", msg.method);
    return;
  }
  // Notification (event stream).
  if (msg.method !== undefined && msg.id === undefined) {
    log("NOTIFICATION method=", msg.method);
    return;
  }
  // Response to one of our requests.
  if (msg.id !== undefined && pending.has(msg.id)) {
    const { resolve, reject, timer } = pending.get(msg.id);
    pending.delete(msg.id);
    clearTimeout(timer);
    if (msg.error) reject(new Error(`App Server error code ${msg.error.code ?? "unknown"}`));
    else resolve(msg.result);
    return;
  }
  log("UNMATCHED protocol message");
});

child.stderr.on("data", () => {
  stderrSeen = true;
});

child.on("exit", (code, signal) => {
  log("app-server exited code=", code, "signal=", signal);
  if (stderrSeen) log("App Server wrote diagnostic output to stderr.");
});

function send(obj) {
  child.stdin.write(JSON.stringify(obj) + "\n");
}

function request(method, params = undefined) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`request timeout: ${method}`));
    }, TIMEOUT_MS);
    pending.set(id, { resolve, reject, timer });
    const frame = { jsonrpc: "2.0", id, method };
    if (params !== undefined) frame.params = params;
    send(frame);
  });
}

function notify(method, params = undefined) {
  const frame = { jsonrpc: "2.0", method };
  if (params !== undefined) frame.params = params;
  send(frame);
}

async function main() {
  log("codex exe:", CODEX_EXE);
  log("codex home:", CODEX_HOME);

  const init = await request("initialize", {
    clientInfo: { name: "dicode", version: "0.1.0" },
    capabilities: {},
  });
  log("initialize OK", init.platformFamily ?? "");

  notify("initialized");
  log("initialized sent");

  const account = await request("account/read", {});
  log("account/read OK", account.account ? "signed in" : "no account returned");

  const models = await request("model/list", { limit: 10 });
  log("model/list OK", models.data.length, "returned");

  const threads = await request("thread/list", { limit: 5 });
  log("thread/list OK", threads.data.length, "returned");

  await request("config/read", {});
  log("config/read OK");

  log("ALL HANDSHAKE CHECKS PASSED");
  child.stdin.end();
  setTimeout(() => child.kill(), 500);
}

main().catch((err) => {
  log("HANDSHAKE FAILED:", err.message);
  child.kill();
  process.exitCode = 1;
});
