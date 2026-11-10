import { createHash } from "node:crypto";
import { closeSync, existsSync, openSync, readFileSync, readSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { CodexClient } from "@dicode/codex-adapter";
import { BUNDLED_CODEX_EXECUTABLE, BUNDLED_CODEX_FILES, BUNDLED_CODEX_VERSION, PRODUCT_VERSION, getBundledRuntimeDir, getDataDir, isPackagedDicode } from "@dicode/shared";
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
  const packaged = isPackagedDicode();
  const { appServer, account } = packaged && !bundledRuntime.ok
    ? { appServer: { name: "App Server Startup", ok: false, detail: "Reinstall or re-extract Dicode and try again." }, account: undefined }
    : await inspectAppServer(15_000, true);
  checks.push(!packaged && !existsSync(join(runtimeDir, BUNDLED_CODEX_EXECUTABLE)) && appServer.ok
    ? { name: "Codex Runtime", ok: true, detail: "Development runtime." }
    : bundledRuntime);
  const sqlite = checkSqlite();
  checks.push(checkUserData());
  checks.push(appServer);
  if (account) checks.push(account);
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
  const name = "Bundled Codex Runtime";
  const manifest = readManifest(join(dir, "version.json"));
  if (!manifest || manifest.codexVersion !== BUNDLED_CODEX_VERSION || manifest.platform !== "windows-x64") {
    return {
      name,
      ok: false,
      detail: `Expected Codex ${BUNDLED_CODEX_VERSION} (windows-x64) in ${dir}. Reinstall or re-extract Dicode.`,
    };
  }
  for (const path of BUNDLED_CODEX_FILES) {
    const expected = manifest.files?.[path];
    if (typeof expected?.sizeBytes !== "number" || expected.sizeBytes <= 0 ||
        typeof expected.sha256 !== "string" || !/^[a-f0-9]{64}$/u.test(expected.sha256)) {
      return { name, ok: false, detail: `Missing integrity record for ${path}.` };
    }
    const integrity = verifyIntegrity(join(dir, path), expected);
    if (!integrity.ok) return { name, ok: false, detail: `${path}: ${integrity.reason}` };
  }
  return {
    name,
    ok: true,
    detail: `Codex ${manifest.codexVersion} at ${dir}. Runtime files verified.`,
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
  return (await inspectAppServer(timeoutMs, false)).appServer;
}

async function inspectAppServer(timeoutMs: number, checkAccount: boolean): Promise<{ appServer: DoctorCheck; account?: DoctorCheck }> {
  let client: CodexClient | undefined;
  try {
    client = new CodexClient({ defaultTimeoutMs: timeoutMs });
    await client.start();
    await client.healthCheck(timeoutMs);
    const appServer = { name: "App Server Startup", ok: true, detail: "initialize + model/list + JSON-RPC OK" };
    if (!checkAccount) return { appServer };
    try {
      const { account, requiresOpenaiAuth } = await client.readAccount();
      return {
        appServer,
        account: {
          name: "Codex Authentication",
          ok: Boolean(account) || !requiresOpenaiAuth,
          detail: account ? "Account configured." : requiresOpenaiAuth
            ? "Run dicode login to sign in."
            : "The configured provider does not require OpenAI sign-in.",
        },
      };
    } catch {
      return { appServer, account: { name: "Codex Authentication", ok: false, detail: "Could not read account status." } };
    }
  } catch (error) {
    return { appServer: { name: "App Server Startup", ok: false, detail: (error as Error).message } };
  } finally {
    await client?.stop().catch(() => undefined);
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
    if (!stat.isFile()) return { ok: false, reason: "Expected a regular file." };
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
  const descriptor = openSync(file, "r");
  const chunk = Buffer.allocUnsafe(1024 * 1024);
  try {
    let bytes: number;
    while ((bytes = readSync(descriptor, chunk, 0, chunk.length, null)) > 0) {
      hash.update(chunk.subarray(0, bytes));
    }
  } finally {
    closeSync(descriptor);
  }
  return hash.digest("hex");
}

function defaultRuntimeDir(): string {
  return getBundledRuntimeDir();
}
