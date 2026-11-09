// Generates runtime/codex/version.json with SHA-256 checksums for the bundled
// Codex binaries. Run from the repository root after placing binaries.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const RUNTIME_DIR = join(process.cwd(), "runtime", "codex");
const BINARIES = [
  "codex.exe",
  "codex-code-mode-host.exe",
  "codex-command-runner.exe",
  "codex-windows-sandbox-setup.exe",
];

const manifestPath = join(RUNTIME_DIR, "version.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

for (const name of BINARIES) {
  const path = join(RUNTIME_DIR, name);
  if (!existsSync(path)) continue;
  const stat = statSync(path);
  const hash = createHash("sha256").update(readFileSync(path)).digest("hex");
  manifest.files[name] = { sha256: hash, sizeBytes: stat.size };
}

manifest.buildTime = new Date().toISOString();
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log("Wrote", manifestPath);
console.log(JSON.stringify(manifest, null, 2));
