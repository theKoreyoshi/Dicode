import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { CodexClient } from "@dicode/codex-adapter";
import { PRODUCT_VERSION } from "@dicode/shared";
import { getBundledRuntimeDir, getDataDir } from "@dicode/shared";
import { Database } from "@dicode/core";

export interface DoctorCheck {
  name: string;
  ok: boolean;
  detail?: string;
}

export interface RuntimeVersionManifest {
  dicodeVersion: string;
  codexVersion: string;
  platform: string;
  buildTime?: string;
  source?: string;
  files?: Record<string, { sha256?: string; sizeBytes?: number }>;
}

export async function runDoctor(): Promise<DoctorCheck[]> {
  const checks: DoctorCheck[] = [];
  checks.push(checkEnvironment());
  checks.push(checkDicodeVersion());

  const runtimeDir = defaultRuntimeDir();
  const bundledRuntime = checkBundledRuntime(runtimeDir);
  const appServer = await checkAppServer();
  checks.push(!existsSync(join(runtimeDir, "codex.exe")) && appServer.ok
    ? { name: "Codex Runtime", ok: true, detail: "Using an external Codex runtime." }
    : bundledRuntime);
  const sqlite = checkSqlite();
  checks.push(checkUserData());
  checks.push(appServer);
  checks.push(sqlite);
  return checks;
}

export function renderDoctorReport(checks: DoctorCheck[]): string {
  const lines = ["Dicode Environment Diagnostic", ""];
  let ready = true;
  for (const check of checks) {
    if (!check.ok) ready = false;
    lines.push(`${check.ok ? "[OK]" : "[FAIL]"} ${check.name}`);
    if (check.detail) lines.push(`    ${check.detail}`);
  }
  lines.push("", `Result: ${ready ? "Environment Ready" : "Environment has problems"}`);
  return lines.join("\n");
}

export function checkEnvironment(): DoctorCheck {
  const platform = process.platform;
  const arch = process.arch;
  if (platform !== "win32" || arch !== "x64") {
    return { name: "Windows Environment", ok: false, detail: `Expected win32-x64, got ${platform}-${arch}` };
  }
  return { name: "Windows Environment", ok: true, detail: `${platform}-${arch}` };
}

export function checkDicodeVersion(): DoctorCheck {
  return { name: "Dicode Version", ok: true, detail: PRODUCT_VERSION };
}

export function checkBundledRuntime(dir = defaultRuntimeDir()): DoctorCheck {
  const codex = join(dir, "codex.exe");
  if (!existsSync(codex)) {
    return {
      name: "Bundled Codex Runtime",
      ok: false,
      detail: `Missing ${codex}. Install Codex or set DICODE_CODEX_EXE to the full path of codex.exe.`,
    };
  }
  const manifest = readManifest(join(dir, "version.json"));
  const integrity = verifyIntegrity(codex, manifest?.files?.["codex.exe"]);
  return {
    name: "Bundled Codex Runtime",
    ok: integrity.ok,
    detail: integrity.ok ? `${codex} (${manifest?.codexVersion ?? "unknown"})` : integrity.reason,
  };
}

/** Diagnostic: reports the candidate path sources for SEA install-dir resolution. */
export function pathDiagnostic(): Record<string, string> {
  return {
    execPath: process.execPath,
    argv0: process.argv[0] ?? "",
    argv1: process.argv[1] ?? "",
    cwd: process.cwd(),
    dirnameExecPath: dirname(process.execPath),
    dirnameArgv0: dirname(process.argv[0] ?? ""),
    installDir: defaultRuntimeDir(),
  };
}

export function checkUserData(): DoctorCheck {
  const dataDir = getDataDir();
  try {
    return { name: "User Data Directory", ok: existsSync(dataDir), detail: dataDir };
  } catch {
    return { name: "User Data Directory", ok: false, detail: dataDir };
  }
}

export async function checkAppServer(timeoutMs = 15_000): Promise<DoctorCheck> {
  const client = new CodexClient({ defaultTimeoutMs: timeoutMs });
  try {
    await client.start();
    await client.healthCheck(timeoutMs);
    await client.stop();
    return { name: "App Server Startup", ok: true, detail: "initialize + model/list + JSON-RPC OK" };
  } catch (error) {
    await client.stop().catch(() => {});
    return { name: "App Server Startup", ok: false, detail: (error as Error).message };
  }
}

export function checkSqlite(): DoctorCheck {
  const dbPath = join(getDataDir(), "dicode.db");
  try {
    const db = new Database({ path: dbPath });
    db.close();
    return { name: "SQLite Storage", ok: true, detail: dbPath };
  } catch (error) {
    return { name: "SQLite Storage", ok: false, detail: (error as Error).message };
  }
}

export function readManifest(path: string): RuntimeVersionManifest | null {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as RuntimeVersionManifest;
  } catch {
    return null;
  }
}

export function verifyIntegrity(file: string, expected?: { sha256?: string; sizeBytes?: number }): { ok: boolean; reason?: string } {
  try {
    const stat = statSync(file);
    if (expected?.sizeBytes && stat.size !== expected.sizeBytes) {
      return { ok: false, reason: `size mismatch: ${stat.size} != ${expected.sizeBytes}` };
    }
    if (expected?.sha256) {
      const actual = sha256File(file);
      if (actual !== expected.sha256) return { ok: false, reason: `sha256 mismatch: ${actual}` };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: (error as Error).message };
  }
}

export function sha256File(file: string): string {
  const hash = createHash("sha256");
  hash.update(readFileSync(file));
  return hash.digest("hex");
}

function defaultRuntimeDir(): string {
  return getBundledRuntimeDir();
}
