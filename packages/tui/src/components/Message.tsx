import { stripVTControlCharacters } from "node:util";
import { Text } from "ink";
import stringWidth from "string-width";
import wrapAnsi from "wrap-ansi";
import type { UiMessage, UiTool } from "../state/ui-store.js";
import { COLORS } from "../theme/colors.js";
import { highlightLine } from "../utils/markdown.js";
import { markdownLines } from "./Markdown.js";

export interface TranscriptLine {
  text: string;
  color?: string;
  bold?: boolean;
  indent?: string;
  background?: string;
  preformatted?: boolean;
  codeLanguage?: string;
}

const messageCache = new WeakMap<UiMessage, TranscriptLine[]>();
const wrappedLines = new WeakMap<TranscriptLine, { width: number; lines: TranscriptLine[] }>();
const toolCategories: Record<string, string> = {
  commandExecution: "Shell",
  fileChange: "Files",
  mcpToolCall: "MCP",
  webSearch: "Search",
  collabAgentToolCall: "Agent",
};

export function messageLines(message: UiMessage): TranscriptLine[] {
  const cached = messageCache.get(message);
  if (cached) return cached;

  const content = cleanText(message.content);
  const lines: TranscriptLine[] = [];
  if (message.role === "user") {
    lines.push(
      { text: "You", color: COLORS.primaryBlue, bold: true, indent: "│ ", background: COLORS.primaryBackground },
      { text: content, indent: "│ ", background: COLORS.primaryBackground },
    );
  } else if (content || message.streaming) {
    lines.push({ text: "Dicode", color: COLORS.accentBlue, bold: true });
    if (content) lines.push(...markdownLines(content));
    if (message.streaming) lines.push({ text: content ? "▌" : "◌ Working…", color: COLORS.accentBlue });
  }
  if (lines.length) lines.push({ text: "" });
  messageCache.set(message, lines);
  return lines;
}

export function toolLines(tool: UiTool, showDetails: boolean): TranscriptLine[] {
  const status = {
    running: { icon: "◌", color: COLORS.accentBlue },
    completed: { icon: "✓", color: COLORS.success },
    failed: { icon: "✗", color: COLORS.error },
  }[tool.status];
  const duration = tool.durationMs === undefined ? "" : ` · ${formatDuration(tool.durationMs)}`;
  const exit = tool.exitCode === undefined ? "" : ` · exit ${tool.exitCode}`;
  const label = cleanText(tool.label).replaceAll("\n", " ").trim();
  const category = toolCategories[tool.type] ?? "Tool";
  const detail = label && label !== tool.type ? ` · ${label}` : "";
  const lines: TranscriptLine[] = [{ text: `${status.icon} ${category}${detail}${duration}${exit}`, color: status.color }];
  if (showDetails && tool.output?.trim()) {
    lines.push({
      text: cleanText(tool.output).trimEnd(),
      indent: "  │ ",
      preformatted: true,
      color: tool.status === "failed" ? COLORS.error : COLORS.secondaryText,
    });
  }
  return lines;
}

export function wrapTranscriptLine(line: TranscriptLine, width: number): TranscriptLine[] {
  const cached = wrappedLines.get(line);
  if (cached?.width === width) return cached.lines;

  const indent = line.indent && stringWidth(line.indent) < width - 1 ? line.indent : "";
  const indentWidth = stringWidth(indent);
  const textWidth = Math.max(1, width - indentWidth);
  const rows = wrapAnsi(line.text, textWidth, { hard: true, trim: !line.preformatted }).split("\n");
  const lines = rows.map((text, index) => {
    const prefix = index && /^(?:\d+\.|•) $/u.test(indent) ? " ".repeat(indentWidth) : indent;
    const padding = line.background ? " ".repeat(Math.max(0, textWidth - stringWidth(text))) : "";
    return { ...line, text: text + padding, indent: prefix };
  });
  wrappedLines.set(line, { width, lines });
  return lines;
}

export function MessageLine({ line }: { line: TranscriptLine }) {
  const code = line.codeLanguage === undefined ? null : highlightLine(line.text, line.codeLanguage);
  return (
    <Text wrap="truncate-end" bold={line.bold} color={line.color ?? COLORS.text} backgroundColor={line.background}>
      {line.indent && <Text color={COLORS.primaryBlue}>{line.indent}</Text>}
      {code ? code.map(({ text, color }, index) => <Text color={color} key={index}>{text}</Text>) : line.text || " "}
    </Text>
  );
}

function cleanText(text: string): string {
  return stripVTControlCharacters(text)
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n")
    .replaceAll("\t", "    ")
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F-\u009F]/g, "");
}

function formatDuration(milliseconds: number): string {
  return milliseconds < 1000 ? `${milliseconds} ms` : `${(milliseconds / 1000).toFixed(1)} s`;
}
