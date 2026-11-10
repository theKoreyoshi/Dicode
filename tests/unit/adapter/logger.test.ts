import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Logger } from "@dicode/codex-adapter";

describe("adapter diagnostics", () => {
  it("redacts sensitive field names and credential strings in the log file", () => {
    const directory = mkdtempSync(join(tmpdir(), "dicode-adapter-log-"));
    try {
      new Logger({ logDir: directory }).warn("authorization=Bearer first-value", {
        access_token: "second-value",
        message: "api_key=third-value",
        pid: 42,
      });
      const log = readFileSync(join(directory, "adapter.log"), "utf8");
      expect(log).not.toMatch(/first-value|second-value|third-value/u);
      expect(JSON.parse(log)).toMatchObject({ level: "warn", fields: { pid: 42 } });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
