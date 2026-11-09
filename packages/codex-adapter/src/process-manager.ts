/**
 * Manages the `codex app-server` child process.
 *
 * Phase 2 implements: locating codex.exe, spawning with a clean protocol
 * stdout, isolating stderr to the log sink, restart/graceful-shutdown handling,
 * and abnormal-exit detection. This file only declares the public contract.
 */
export interface AppServerProcess {
  readonly pid: number | undefined;
  write(line: string): void;
  stop(signal?: NodeJS.Signals): Promise<void>;
}

export interface AppServerProcessHandle {
  start(): Promise<AppServerProcess>;
  stop(): Promise<void>;
}
