import { describe, expect, it } from "vitest";
import { markdownToPlainText, parseMarkdown, highlightLine } from "@dicode/tui";

describe("markdown", () => {
  it("parses headings, code blocks, and lists", () => {
    const md = "# Title\n\n```ts\nconst x = 1;\n```\n\n- a\n- b";
    const blocks = parseMarkdown(md);
    expect(blocks[0]).toMatchObject({ type: "heading", depth: 1, text: "Title" });
    expect(blocks[1]).toMatchObject({ type: "code", language: "ts" });
    expect(blocks[2]).toMatchObject({ type: "list", items: ["a", "b"] });
  });

  it("converts to plain text", () => {
    expect(markdownToPlainText("# Hi\n\nBody")).toBe("Hi\nBody");
  });

  it("highlights a code line into colored segments", () => {
    const segments = highlightLine("const x = 1;", "ts");
    expect(segments.length).toBeGreaterThan(1);
    expect(segments.map((s) => s.text).join("")).toBe("const x = 1;");
  });
});
