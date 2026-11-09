import { describe, expect, it } from "vitest";
import { parseArgs, HELP_TEXT } from "@dicode/cli";

describe("parseArgs", () => {
  it("parses --version and --help", () => {
    expect(parseArgs(["--version"]).version).toBe(true);
    expect(parseArgs(["--help"]).help).toBe(true);
  });

  it("parses --cwd with a separate value", () => {
    expect(parseArgs(["--cwd", "D:\\Projects\\Demo"]).cwd).toBe("D:\\Projects\\Demo");
  });

  it("parses --cwd= inline", () => {
    expect(parseArgs(["--cwd=C:\\Proj"]).cwd).toBe("C:\\Proj");
  });

  it("parses --resume", () => {
    expect(parseArgs(["--resume"]).resume).toBe(true);
  });

  it("exposes a non-empty help text", () => {
    expect(HELP_TEXT).toContain("dicode");
  });
});
