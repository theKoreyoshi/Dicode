import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { EventEmitter } from "node:events";
import type { Readable, Writable } from "node:stream";
import { ProcessExitError, ProcessStartError } from "../errors/adapter-errors.js";
import { logger } from "../logger.js";
import { resolveProcessConfig, type ProcessConfig } from "./process-config.js";

export type ProcessStatus = "stopped" | "starting" | "running" | "stopping" | "crashed";

export interface ProcessInfo {
  pid: number | null;
  status: ProcessStatus;
  executablePath: string;
  spawnedAtMs: number | null;
  exitCode: number | null;
}

export interface ProcessManagerEvents {
  status: [status: ProcessStatus, info: ProcessInfo];
  exit: [info: { code: number | null; signal: NodeJS.Signals | null }];
  error: [error: Error];
}

export interface ProcessManagerOptions {
  config?: ProcessConfig;
  /** Graceful shutdown timeout before force-kill, in milliseconds. */
  stopTimeoutMs?: number;
}

/**
 * Manages the `codex app-server` child process lifecycle. `stdout` is reserved
 * for the JSON-RPC protocol; `stderr` is captured for logging.
 */
export class ProcessManager extends EventEmitter<ProcessManagerEvents> {
  private readonly config: ProcessConfig;
  private readonly stopTimeoutMs: number;
  private child: ChildProcessWithoutNullStreams | null = null;
  private status: ProcessStatus = "stopped";
  private spawnedAtMs: number | null = null;
  private exitCode: number | null = null;
  private stopping = false;

  constructor(options: ProcessManagerOptions = {}) {
    super();
    this.config = options.config ?? resolveProcessConfig();
    this.stopTimeoutMs = options.stopTimeoutMs ?? 3000;
  }

  get stdout(): Readable | null {
    return this.child?.stdout ?? null;
  }

  get stdin(): Writable | null {
    return this.child?.stdin ?? null;
  }

  get stderr(): Readable | null {
    return this.child?.stderr ?? null;
  }

  getStatus(): ProcessStatus {
    return this.status;
  }

  isRunning(): boolean {
    return this.status === "running";
  }

  getProcessInfo(): ProcessInfo {
    return {
      pid: this.child?.pid ?? null,
      status: this.status,
      executablePath: this.config.executablePath,
      spawnedAtMs: this.spawnedAtMs,
      exitCode: this.exitCode,
    };
  }

  async start(): Promise<void> {
    if (this.status === "running" || this.status === "starting") {
      return;
    }
    this.setStatus("starting");
    this.stopping = false;
    this.exitCode = null;

    logger.info("starting codex app-server", {
      executablePath: this.config.executablePath,
      cwd: this.config.cwd,
    });

    try {
      this.child = spawn(this.config.executablePath, this.config.args, {
        cwd: this.config.cwd,
        env: this.config.env,
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
        shell: false,
      });
    } catch (error) {
      this.setStatus("crashed");
      throw new ProcessStartError("Failed to spawn codex.exe", { cause: error });
    }

    this.spawnedAtMs = Date.now();
    this.setStatus("running");

    this.child.once("spawn", () => {
      logger.info("codex app-server spawned", { pid: this.child?.pid });
    });

    this.child.on("error", (error) => {
      logger.error("codex app-server process error", { message: error.message });
      this.emit("error", error);
    });

    this.child.once("exit", (code, signal) => {
      const wasStopping = this.stopping;
      this.exitCode = code;
      this.child = null;
      this.setStatus(wasStopping ? "stopped" : "crashed");
      if (!wasStopping && code !== 0 && code !== null) {
        const err = new ProcessExitError(`codex app-server exited unexpectedly (code ${code})`);
        this.emit("error", err);
      }
      this.emit("exit", { code, signal });
    });
  }

  async stop(): Promise<void> {
    if (!this.child || this.status === "stopped" || this.status === "stopping") {
      this.child = null;
      this.setStatus("stopped");
      return;
    }

    this.stopping = true;
    this.setStatus("stopping");
    const child = this.child;

    const exited = new Promise<void>((resolve) => {
      child.once("exit", () => resolve());
    });

    // Close stdin first so the server sees EOF on the protocol channel.
    try {
      child.stdin.end();
    } catch {
      // ignore
    }

    const graceful = await withTimeout(exited, this.stopTimeoutMs).catch(() => false);
    if (!graceful && this.child) {
      logger.warn("app-server did not exit gracefully; force-killing", { pid: child.pid });
      await forceKillTree(child.pid);
    }

    await withTimeout(exited, 2000).catch(() => {});
  }

  async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }

  private setStatus(status: ProcessStatus): void {
    this.status = status;
    this.emit("status", status, this.getProcessInfo());
  }
}

async function forceKillTree(pid: number | undefined): Promise<void> {
  if (pid === undefined) return;
  const { spawn: spawnProc } = await import("node:child_process");
  await new Promise<void>((resolve) => {
    const killer = spawnProc("taskkill", ["/PID", String(pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
      shell: false,
    });
    killer.once("exit", () => resolve());
    killer.once("error", () => resolve());
  });
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | false> {
  return Promise.race([
    promise,
    new Promise<false>((resolve) => setTimeout(() => resolve(false), ms)),
  ]);
}
