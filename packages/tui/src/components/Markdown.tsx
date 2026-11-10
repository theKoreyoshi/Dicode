import { COLORS } from "../theme/colors.js";
import { parseMarkdown } from "../utils/markdown.js";
import type { TranscriptLine } from "./Message.js";

export function markdownLines(content: string): TranscriptLine[] {
  const lines: TranscriptLine[] = [];
  for (const block of parseMarkdown(content)) {
    if (lines.length) lines.push({ text: "" });
    switch (block.type) {
      case "heading":
        lines.push({ text: block.text, bold: true, color: COLORS.accentBlue });
        break;
      case "paragraph":
        lines.push({ text: block.text });
        break;
      case "code":
        lines.push({ text: block.language || "code", bold: true, color: COLORS.secondaryText, indent: "  " });
        lines.push(...block.code.split("\n").map((text) => ({
          text,
          indent: "  ",
          preformatted: true,
          codeLanguage: block.language,
        })));
        break;
      case "list":
        lines.push(...block.items.map((text, index) => ({
          text,
          indent: block.ordered ? `${index + 1}. ` : "• ",
        })));
        break;
      case "quote":
        lines.push({ text: block.text, color: COLORS.secondaryText, indent: "│ " });
        break;
      case "hr":
        lines.push({ text: "──────────────", color: COLORS.border });
        break;
    }
  }
  return lines;
}
