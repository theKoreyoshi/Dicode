import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { BUNDLED_CODEX_FILES, BUNDLED_CODEX_VERSION } from "@dicode/shared";
import {
  checkBundledRuntime,
  checkDicodeVersion,
  checkEnvironment,
  readManifest,
  sha256File,
  verifyIntegrity,
} from "@dicode/cli";

describe("doctor diagnostics", () => {
  it("reports the windows environment", () => {
    expect(checkEnvironment().name).toBe("Windows Environment");
  });

  it("reports the dicode version", () => {
    expect(checkDicodeVersion().ok).toBe(true);
    expect(checkDicodeVersion().detail).toBeTruthy();
  });

  it("verifies file integrity by sha256 and size", () => {
    const dir = mkdtempSync(join(tmpdir(), "dicode-doc-"));
    const file = join(dir, "f.bin");
    writeFileSync(file, "hello");
    const sha = sha256File(file);
    expect(verifyIntegrity(file, { sha256: sha, sizeBytes: 5 }).ok).toBe(true);
    expect(verifyIntegrity(file, { sha256: "0".repeat(64) }).ok).toBe(false);
    expect(verifyIntegrity(file, { sizeBytes: 999 }).ok).toBe(false);
    rmSync(dir, { recursive: true, force: true });
  });

  it("reads a runtime manifest", () => {
    const dir = mkdtempSync(join(tmpdir(), "dicode-man-"));
    const path = join(dir, "version.json");
    writeFileSync(path, JSON.stringify({ dicodeVersion: "0.1.0", codexVersion: "x" }));
    expect(readManifest(path)?.codexVersion).toBe("x");
    rmSync(dir, { recursive: true, force: true });
  });

  it("checks the full pinned package, including companion integrity", () => {
    const dir = mkdtempSync(join(tmpdir(), "dicode-bundle-"));
    try {
      const files = Object.fromEntries(BUNDLED_CODEX_FILES.map((path) => {
        const target = join(dir, path);
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, "file");
        return [path, { sha256: sha256File(target), sizeBytes: 4 }];
      }));
      writeFileSync(join(dir, "version.json"), JSON.stringify({
        dicodeVersion: "0.1.0", codexVersion: BUNDLED_CODEX_VERSION, platform: "windows-x64", files,
      }));
      expect(checkBundledRuntime(dir).ok).toBe(true);
      writeFileSync(join(dir, "bin/codex-code-mode-host.exe"), "edit");
      expect(checkBundledRuntime(dir)).toMatchObject({
        ok: false, detail: expect.stringContaining("bin/codex-code-mode-host.exe: sha256 mismatch"),
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
