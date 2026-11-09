import { describe, expect, it } from "vitest";
import { parsePorcelain } from "@dicode/tui";

describe("parsePorcelain", () => {
  it("counts modified, added, deleted, and untracked files", () => {
    const status = parsePorcelain(" M src/index.ts\nA  src/new.ts\nD  src/old.ts\n?? src/untracked.ts\n");
    expect(status.modified).toBe(1);
    expect(status.added).toBe(1);
    expect(status.deleted).toBe(1);
    expect(status.untracked).toBe(1);
  });
});
