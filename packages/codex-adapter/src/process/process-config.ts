import { existsSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { RuntimeNotFoundError } from "../errors/adapter-errors.js";

export interface ProcessConfig {
  /** Absolute path to codex.exe. */
  executablePath: string;
  /** Arguments passed to codex.exe (always an array, never a shell string). */
  args: string[];
  /** Working directory for the child process. */
  cwd: string;
  /** Environment inherited from the parent plus required overrides. */
  env: NodeJS.ProcessEnv;
}

export interface ResolveProcessConfigOptions {
  executablePath?: string;
  cwd?: string;
  listenUrl?: string;
  codexHome?: string;
  env?: NodeJS.ProcessEnv;
}

export function resolveProcessConfig(
  options: ResolveProcessConfigOptions = {},
): ProcessConfig {
  const executablePath = resolveCodexExecutable(options.executablePath);
  const cwd = options.cwd ?? process.cwd();
  const home = options.codexHome ?? process.env.USERPROFILE ?? homedir();
  const codexHome = options.codexHome ?? join(home, ".codex");

  return {
    executablePath,
    args: ["app-server", "--listen", options.listenUrl ?? "stdio://"],
    cwd,
    env: {
      ...process.env,
      ...(options.env ?? {}),
      HOME: home,
      CODEX_HOME: codexHome,
    },
  };
}

export function resolveCodexExecutable(explicit?: string): string {
  const candidates: string[] = [];

  if (explicit) candidates.push(explicit);
  if (process.env.DICODE_CODEX_EXE) candidates.push(process.env.DICODE_CODEX_EXE);
  if (process.env.CODEX_PATH) candidates.push(process.env.CODEX_PATH);

  const localAppData = process.env.LOCALAPPDATA;
  if (localAppData) {
    const binRoot = join(localAppData, "OpenAI", "Codex", "bin");
    if (existsSync(binRoot)) {
      // Prefer the newest versioned install directory.
      const versions = readdirSync(binRoot)
        .map((name) => join(binRoot, name))
        .filter((p) => {
          try {
            return statSync(p).isDirectory();
          } catch {
            return false;
          }
        })
        .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
      for (const dir of versions) {
        candidates.push(join(dir, "codex.exe"));
      }
    }
  }

  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) return candidate;
  }

  // Fall back to PATH lookup.
  for (const name of ["codex.exe", "codex"]) {
    const found = findOnPath(name);
    if (found) return found;
  }

  throw new RuntimeNotFoundError(
    "Could not locate codex.exe. Provide it via DICODE_CODEX_EXE or an explicit path.",
  );
}

function findOnPath(name: string): string | null {
  const pathVar = process.env.PATH ?? "";
  for (const dir of pathVar.split(";")) {
    if (!dir) continue;
    const candidate = join(dir, name);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}
