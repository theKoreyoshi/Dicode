import { existsSync, readdirSync, statSync } from "node:fs";
import { delimiter, join } from "node:path";
import { RuntimeNotFoundError } from "../errors/adapter-errors.js";
import { BUNDLED_CODEX_EXECUTABLE, BUNDLED_CODEX_FILES, getBundledRuntimeDir, isPackagedDicode } from "@dicode/shared";

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
  bundledRuntimeDir?: string;
}

export function resolveProcessConfig(
  options: ResolveProcessConfigOptions = {},
): ProcessConfig {
  const executablePath = resolveCodexExecutable(options.executablePath, options.bundledRuntimeDir);
  const cwd = options.cwd ?? process.cwd();
  const env = { ...process.env, ...options.env };
  const codexDirectory = options.codexHome ?? env.CODEX_HOME;

  return {
    executablePath,
    args: ["app-server", "--listen", options.listenUrl ?? "stdio://"],
    cwd,
    env: {
      ...env,
      ...(codexDirectory ? { CODEX_HOME: codexDirectory } : {}),
    },
  };
}

export function resolveCodexExecutable(explicit?: string, bundledRuntimeDir?: string): string {
  const candidates: string[] = [];
  const bundled = bundledRuntimeDir ?? getBundledRuntimeDir();
  const executable = join(bundled, BUNDLED_CODEX_EXECUTABLE);

  if (isPackagedDicode()) {
    const missing = BUNDLED_CODEX_FILES.filter((file) => !isFile(join(bundled, file)));
    if (missing.length) {
      throw new RuntimeNotFoundError(`Incomplete bundled Codex runtime in ${bundled} (missing ${missing.join(", ")}). Reinstall or re-extract Dicode.`);
    }
    return executable;
  }

  if (explicit) candidates.push(explicit);
  if (process.env.DICODE_CODEX_EXE) candidates.push(process.env.DICODE_CODEX_EXE);
  if (process.env.CODEX_PATH) candidates.push(process.env.CODEX_PATH);
  candidates.push(executable, join(bundled, "codex.exe"));

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
    if (isFile(candidate)) return candidate;
  }

  // Fall back to PATH lookup.
  for (const name of ["codex.exe", "codex"]) {
    const found = findOnPath(name);
    if (found) return found;
  }

  throw new RuntimeNotFoundError(
    "Could not locate codex.exe. The bundled runtime is missing and no override was provided.",
  );
}

function findOnPath(name: string): string | null {
  const pathVar = process.env.PATH ?? "";
  for (const dir of pathVar.split(delimiter)) {
    if (!dir) continue;
    const candidate = join(dir, name);
    if (isFile(candidate)) return candidate;
  }
  return null;
}

function isFile(path: string): boolean {
  try {
    return statSync(path, { throwIfNoEntry: false })?.isFile() ?? false;
  } catch {
    return false;
  }
}
