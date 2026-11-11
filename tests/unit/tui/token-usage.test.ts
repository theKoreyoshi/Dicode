import { describe, expect, it } from "vitest";
import { contextUsagePercent, formatContextUsage } from "@dicode/tui";

describe("context usage", () => {
  it("uses Codex's reserved baseline when calculating active context", () => {
    const usage = { contextTokens: 18_000, modelContextWindow: 40_000 };
    expect(contextUsagePercent(usage)).toBe(21);
    expect(formatContextUsage(usage)).toBe("18K/40K (21%)");
  });

  it("keeps the displayed percentage within the model context window", () => {
    expect(contextUsagePercent({ contextTokens: 100_000, modelContextWindow: 40_000 })).toBe(100);
    expect(contextUsagePercent({ contextTokens: 10_000, modelContextWindow: 40_000 })).toBe(0);
  });

  it("shows the token count without inventing a percentage when the window is unknown", () => {
    const usage = { contextTokens: 2_400, modelContextWindow: null };
    expect(contextUsagePercent(usage)).toBeNull();
    expect(formatContextUsage(usage)).toBe("2.4K tokens");
  });
});
