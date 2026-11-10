import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

function runCli(...args: string[]) {
  return spawnSync(process.execPath, ["--import", "tsx", "packages/cli/src/index.ts", ...args], {
    encoding: "utf8",
    timeout: 10_000,
  });
}

describe("CLI with redirected streams", () => {
  it("gives an actionable error before starting the terminal UI", () => {
    const result = runCli();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("requires an interactive terminal");
    expect(result.stdout).toBe("");
  });

  it("allows help without a terminal", () => {
    const result = runCli("--help");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("dicode doctor");
  });
});
