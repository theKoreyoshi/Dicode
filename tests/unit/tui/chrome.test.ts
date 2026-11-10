import { PassThrough } from "node:stream";
import { stripVTControlCharacters } from "node:util";
import { render } from "ink";
import { createElement, type ComponentProps, type ReactElement } from "react";
import stringWidth from "string-width";
import { describe, expect, it } from "vitest";
import { Input, measureComposerHeight } from "../../../packages/tui/src/components/Input.js";
import { StatusBar } from "../../../packages/tui/src/components/StatusBar.js";
import { Welcome } from "../../../packages/tui/src/screens/Welcome.js";

function frame(view: ReactElement, columns: number) {
  const stdout = Object.assign(new PassThrough(), { columns }) as unknown as NodeJS.WriteStream;
  let captured = "";
  stdout.on("data", (chunk: Buffer) => { captured += chunk.toString(); });
  const app = render(view, { stdout, debug: true, patchConsole: false });
  try {
    return stripVTControlCharacters(captured).split("\n");
  } finally {
    app.unmount();
  }
}

const draft = "检查这个中文路径\n第二行";
const composer: ComponentProps<typeof Input> = {
  value: draft,
  cursor: draft.length,
  width: 75,
  maxRows: 4,
  focused: true,
  running: false,
  mode: "plan",
  model: "gpt-6.1-terra",
  effort: "medium",
  queued: null,
};

describe("terminal chrome", () => {
  it("renders a measured prompt frame with a separate one-line settings area", () => {
    const lines = frame(createElement(Input, composer), composer.width);
    expect(lines).toHaveLength(measureComposerHeight(composer));
    expect(lines[0]).toMatch(/^╭─+╮$/u);
    expect(lines[1]).toContain("› 检查这个中文路径");
    expect(lines[3]).toMatch(/^╰─+╯$/u);
    expect(lines[4]).toContain("Agent Plan");
    expect(lines[4]).toContain("Model gpt-6.1-terra");
    expect(lines[4]).toContain("Effort medium");
    expect(lines.every((line) => stringWidth(line) <= composer.width)).toBe(true);
  });

  it("keeps wrapped drafts, queued status and settings within a narrow terminal", () => {
    const props = {
      ...composer, width: 20, queued: "Review the remaining files",
      model: "gpt-6.1-terra-with-a-long-name",
    };
    const lines = frame(createElement(Input, props), props.width);
    expect(lines).toHaveLength(measureComposerHeight(props));
    expect(lines[0]).toMatch(/^│ › /u);
    expect(lines.at(-2)).toContain("Queued");
    expect(lines.at(-1)).toContain("Plan");
    expect(lines.at(-1)).toContain("medium");
    expect(lines.every((line) => stringWidth(line) <= props.width)).toBe(true);
  });

  it("gives a short welcome view entirely to the expanded composer", () => {
    const props = { ...composer, width: 46, compact: true };
    const rows = measureComposerHeight(props);
    const lines = frame(createElement(Welcome, { columns: 50, rows, composerHeight: rows },
      createElement(Input, props)), 50);
    expect(lines).toHaveLength(rows);
    expect(lines[0]).toMatch(/^ {2}│ › /u);
    expect(lines.join("\n")).not.toContain("Dicode");
  });

  it("shows settings and quit shortcuts on wide terminals and hides send hints in dialogs", () => {
    const status = { status: "ready", running: false, columns: 96 } as const;
    const visible = frame(createElement(StatusBar, status), status.columns);
    const dialog = frame(createElement(StatusBar, { ...status, inputVisible: false }), status.columns);
    expect(visible).toHaveLength(1);
    expect(visible[0]).toContain("Enter Send");
    expect(visible[0]).toContain("Ctrl+X S Settings");
    expect(visible[0]).toContain("Ctrl+Q Quit");
    expect(dialog).toHaveLength(1);
    expect(dialog[0]).toContain("Esc Back");
    expect(dialog[0]).not.toContain("Enter Send");
  });
});
