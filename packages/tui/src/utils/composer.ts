import { stripVTControlCharacters } from "node:util";
import stringWidth from "string-width";
import type { KeyEvent } from "./keyboard.js";

const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });
const controlCharacters = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/gu;

export function cleanInput(text: string): string {
  return stripVTControlCharacters(text).replace(/\r\n?/gu, "\n").replace(controlCharacters, "");
}

export function editComposer(value: string, cursor: number, event: KeyEvent) {
  const { key = {}, input = "" } = event;
  const before = value.slice(0, cursor);
  const after = value.slice(cursor);
  const segments = graphemes.segment(value);
  const previous = segments.containing(cursor - 1)?.index ?? 0;
  const nextSegment = segments.containing(cursor);
  const next = nextSegment ? nextSegment.index + nextSegment.segment.length : value.length;
  if (key.leftArrow) return { value, cursor: previous };
  if (key.rightArrow) return { value, cursor: next };
  if (key.ctrl && input === "a") return { value, cursor: before.lastIndexOf("\n") + 1 };
  if (key.ctrl && input === "e") {
    const end = value.indexOf("\n", cursor);
    return { value, cursor: end === -1 ? value.length : end };
  }
  // Ink maps the terminal's ASCII DEL (the normal backspace byte) to delete.
  if (key.backspace || key.delete) return { value: value.slice(0, previous) + after, cursor: previous };
  if (key.ctrl || key.meta || key.tab || key.escape) return { value, cursor };
  const inserted = cleanInput(input);
  return { value: before + inserted + after, cursor: cursor + inserted.length };
}

export function moveBetweenLines(value: string, cursor: number, direction: -1 | 1): number | undefined {
  const start = value.slice(0, cursor).lastIndexOf("\n") + 1;
  const column = [...graphemes.segment(value.slice(start, cursor))].length;
  const lineEnd = value.indexOf("\n", cursor);
  if (direction === -1 && start === 0 || direction === 1 && lineEnd < 0) return undefined;
  const targetStart = direction === -1 ? value.slice(0, start - 1).lastIndexOf("\n") + 1 : lineEnd + 1;
  const targetEnd = value.indexOf("\n", targetStart);
  const line = value.slice(targetStart, targetEnd < 0 ? value.length : targetEnd);
  const offset = [...graphemes.segment(line)][column]?.index ?? line.length;
  return targetStart + offset;
}

export function composerLines(value: string, cursor: number, width: number, rows: number) {
  const lines: Array<{ before: string; cursor?: string; after: string }> = [{ before: "", after: "" }];
  let cells = 0;
  let cursorLine = 0;
  const startLine = () => {
    lines.push({ before: "", after: "" });
    cells = 0;
  };
  const add = (segment: string, index: number, atEnd = false) => {
    const char = segment === "\n" ? " " : segment === "\t" ? "    " : segment;
    const size = stringWidth(char);
    if (cells > 0 && cells + size > width && (segment !== "\n" || index === cursor)) startLine();
    const line = lines[lines.length - 1];
    if (index === cursor) {
      line.cursor = char;
      cursorLine = lines.length - 1;
    } else if (!atEnd && segment !== "\n") {
      if (line.cursor !== undefined) line.after += char;
      else line.before += char;
    }
    cells += size;
    if (segment === "\n") startLine();
  };
  for (const { segment, index } of graphemes.segment(value)) add(segment, index);
  if (cursor === value.length) add(" ", cursor, true);
  const start = Math.min(cursorLine, Math.max(0, lines.length - rows));
  return lines.slice(start, start + rows);
}

export function fileCompletion(value: string, cursor: number) {
  const match = /(?:^|\s)@([^\s"]*)$/u.exec(value.slice(0, cursor));
  if (!match) return null;
  const query = match[1];
  return { query, start: cursor - query.length - 1 };
}
