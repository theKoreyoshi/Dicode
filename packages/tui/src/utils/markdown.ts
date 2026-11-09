import { marked } from "marked";
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
          items: (token.items as Array<{ text?: string; raw?: string }>).map((item) => inlineText(item)),
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
  const regex = /<span class="([^"]*)">([\s\S]*?)<\/span>/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    if (match.index > lastIndex) {
      const plain = decode(html.slice(lastIndex, match.index));
      if (plain) segments.push({ text: plain });
    }
    const classes = match[1].split(/\s+/);
    const hljsClass = classes.find((c) => c.startsWith("hljs-"))?.slice(5);
    const color = hljsClass ? HLJS_COLORS[hljsClass] : undefined;
    segments.push({ text: decode(match[2]), color });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < html.length) {
    const tail = decode(html.slice(lastIndex));
    if (tail) segments.push({ text: tail });
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

function inlineText(token: { text?: string; raw?: string; tokens?: unknown }): string {
  return stripInlineMarkdown(token.text ?? token.raw ?? "");
}

function stripInlineMarkdown(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1");
}
