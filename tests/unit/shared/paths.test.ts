import { describe, expect, it } from "vitest";
import { getBundledRuntimeDir } from "@dicode/shared";

describe("bundled runtime path resolution", () => {
  it("resolves runtime/codex beside the install dir", () => {
    expect(getBundledRuntimeDir("C:\\Program Files\\Dicode")).toBe(
      "C:\\Program Files\\Dicode\\runtime\\codex",
    );
  });

  it("supports paths with spaces", () => {
    expect(getBundledRuntimeDir("C:\\My Apps\\Dicode v1")).toBe(
      "C:\\My Apps\\Dicode v1\\runtime\\codex",
    );
  });

  it("supports Chinese paths", () => {
    expect(getBundledRuntimeDir("C:\\用户\\项目目录")).toBe(
      "C:\\用户\\项目目录\\runtime\\codex",
    );
  });
});
