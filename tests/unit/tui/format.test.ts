import { describe, expect, it } from "vitest";
import { stripAnsi, truncate } from "@dicode/tui";

describe("format helpers", () => {
  it("truncates long text", () => {
    expect(truncate("hello world", 5)).toBe("hell…");
    expect(truncate("hi", 5)).toBe("hi");
  });

  it("strips ANSI escape codes", () => {
    expect(stripAnsi("\u001b[31mred\u001b[0m")).toBe("red");
  });
});
