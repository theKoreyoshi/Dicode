import { homedir } from "node:os";
import { dirname, join } from "node:path";

/** Dicode user-data base directory (`%APPDATA%\Dicode`). */
export function getDicodeHome(): string {
  const base = process.env.APPDATA ?? process.env.LOCALAPPDATA ?? join(homedir(), "AppData", "Roaming");
  return join(base, "Dicode");
}

export function getConfigDir(): string {
  return join(getDicodeHome(), "config");
}

export function getDataDir(): string {
  return join(getDicodeHome(), "data");
}

export function getLogsDir(): string {
  return join(getDicodeHome(), "logs");
}

export function getCacheDir(): string {
  return join(getDicodeHome(), "cache");
}

/** Install directory: the directory containing the running executable. */
export function getInstallDir(): string {
  return dirname(process.execPath);
}

/** Bundled Codex runtime directory: `runtime/codex` beside `dicode.exe`. */
export function getBundledRuntimeDir(installDir = getInstallDir()): string {
  return join(installDir, "runtime", "codex");
}

export function isPackagedDicode(): boolean {
  // Set by the SEA bundle banner before importing Dicode.
  return (globalThis as typeof globalThis & { DICODE_SEA?: boolean }).DICODE_SEA === true;
}
