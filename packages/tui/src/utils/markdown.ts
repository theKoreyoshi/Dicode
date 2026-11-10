import { marked, type Token } from "marked";
import { highlight } from "cli-highlight";
import hljs from "highlight.js";

export type MdBlock =
  | { type: "heading"; depth: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "code"; language: string; code: string; highlighted: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "quote"; text: string }
  | { type: "hr" };

/**
 * Parses Markdown into a small block IR for terminal rendering. The parser is
 * pure and does not depend on Ink, so it can be unit-tested.
 */
export function parseMarkdown(markdown: string): MdBlock[] {
  const tokens = marked.lexer(markdown);
  const blocks: MdBlock[] = [];
  for (const token of tokens) {
    switch (token.type) {
      case "heading":
        blocks.push({ type: "heading", depth: token.depth, text: inlineText(token) });
        break;
      case "paragraph":
        blocks.push({ type: "paragraph", text: inlineText(token) });
        break;
      case "code":
        blocks.push({
          type: "code",
          language: token.lang ?? "",
          code: token.text,
          highlighted: highlightCode(token.text, token.lang),
        });
        break;
      case "list":
        blocks.push({
          type: "list",
          ordered: token.ordered,
          items: token.items.map((item: Token) => inlineText(item)),
        });
        break;
      case "blockquote":
        blocks.push({ type: "quote", text: inlineText(token) });
        break;
      case "hr":
        blocks.push({ type: "hr" });
        break;
      case "space":
        break;
      default:
        if (token.raw?.trim()) blocks.push({ type: "paragraph", text: token.raw });
    }
  }
  return blocks;
}

/** Highlights a code block to ANSI using highlight.js (via cli-highlight). */
export function highlightCode(code: string, language?: string): string {
  try {
    return highlight(code, { language: language || undefined, ignoreIllegals: true });
  } catch {
    return code;
  }
}

export interface HighlightSegment {
  text: string;
  color?: string;
}

/**
 * Highlights a single line to colored segments using highlight.js. This is the
 * Ink-safe form of syntax highlighting (ANSI cannot be rendered inside Ink
 * `Text`, so tokens are mapped to Ink colors directly).
 */
export function highlightLine(line: string, language?: string): HighlightSegment[] {
  try {
    const result = language
      ? hljs.highlight(line, { language, ignoreIllegals: true })
      : hljs.highlightAuto(line);
    const html = result.value;
    return parseHighlightHtml(html);
  } catch {
    return [{ text: line }];
  }
}

const HLJS_COLORS: Record<string, string> = {
  keyword: "#258BFF",
  literal: "#258BFF",
  string: "#35C98A",
  comment: "#5A6B87",
  number: "#E9B65B",
  title: "#43C7FF",
  function: "#43C7FF",
  "built_in": "#43C7FF",
  type: "#43C7FF",
  meta: "#91A8C9",
  params: "#91A8C9",
};

function parseHighlightHtml(html: string): HighlightSegment[] {
  const segments: HighlightSegment[] = [];
  const colors: Array<string | undefined> = [];
  for (const [part, classes] of html.matchAll(/<span class="([^"]*)">|<\/span>|[^<]+/gu)) {
    if (classes) {
      const name = classes.split(/\s+/u).find((entry) => entry.startsWith("hljs-"))?.slice(5);
      colors.push((name && HLJS_COLORS[name]) || colors.at(-1));
    } else if (part === "</span>") {
      colors.pop();
    } else {
      segments.push({ text: decode(part), color: colors.at(-1) });
    }
  }
  return segments;
}

function decode(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/** Renders markdown to plain text (for tests and non-rich surfaces). */
export function markdownToPlainText(markdown: string): string {
  return parseMarkdown(markdown)
    .map((block) => {
      switch (block.type) {
        case "code":
          return block.code;
        case "list":
          return block.items.map((item, i) => (block.ordered ? `${i + 1}. ${item}` : `- ${item}`)).join("\n");
        default:
          return "text" in block ? block.text : "";
      }
    })
    .filter(Boolean)
    .join("\n");
}

function inlineText(token: Token): string {
  if (token.type === "br") return "\n";
  if ("tokens" in token && Array.isArray(token.tokens)) return token.tokens.map(inlineText).join("");
  return "text" in token && typeof token.text === "string" ? token.text : token.raw;
}
