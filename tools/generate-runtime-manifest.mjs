// Verifies the pinned coding runtime and writes its install-time manifest.
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const runtimePin = JSON.parse(await readFile(new URL("../runtime/codex/version.json", import.meta.url), "utf8"));

export async function sha256(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

export async function writeRuntimeManifest(runtimeDir, dicodeVersion) {
  for (const [name, expected] of Object.entries(runtimePin.files)) {
    const file = join(runtimeDir, name);
    if ((await stat(file)).size !== expected.sizeBytes || await sha256(file) !== expected.sha256) {
      throw new Error(`Bundled Codex runtime integrity check failed for ${name}.`);
    }
  }

  const path = join(runtimeDir, "version.json");
  const manifest = { ...runtimePin, dicodeVersion, buildTime: new Date().toISOString() };
  await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.argv[2]) throw new Error("Usage: node tools/generate-runtime-manifest.mjs <staged-codex-directory>");
  const { version } = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  await writeRuntimeManifest(resolve(process.argv[2]), version);
}
