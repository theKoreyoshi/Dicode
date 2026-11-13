import { PassThrough } from "node:stream";
import { stripVTControlCharacters } from "node:util";
import { render } from "ink";
import { createElement, type ComponentProps, type ReactElement } from "react";
import stringWidth from "string-width";
import { describe, expect, it } from "vitest";
import { Input, measureComposerHeight } from "../../../packages/tui/src/components/Input.js";
import { Picker } from "../../../packages/tui/src/components/CommandPalette.js";
import { StatusBar } from "../../../packages/tui/src/components/StatusBar.js";
import { Welcome } from "../../../packages/tui/src/screens/Welcome.js";

function frame(view: ReactElement, columns: number) {
  return stripVTControlCharacters(rawFrame(view, columns)).split("\n");
}

function rawFrame(view: ReactElement, columns: number) {
  const stdout = Object.assign(new PassThrough(), { columns }) as unknown as NodeJS.WriteStream;
  let captured = "";
  stdout.on("data", (chunk: Buffer) => { captured += chunk.toString(); });
  const app = render(view, { stdout, debug: true, patchConsole: false });
  try {
    return captured;
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
  it("renders measured shaded padding and a continuous rail around the draft and settings", () => {
    const lines = frame(createElement(Input, composer), composer.width);
    expect(lines).toHaveLength(measureComposerHeight(composer));
    expect(lines).toHaveLength(5);
    expect(lines[0].trimEnd()).toBe("┃");
    expect(lines[1]).toContain("┃ 检查这个中文路径");
    expect(lines[2]).toContain("┃ 第二行");
    expect(lines[3].trimEnd()).toBe("┃");
    expect(lines.at(-1)).toContain("Plan");
    expect(lines.at(-1)).toContain("gpt-6.1-terra");
    expect(lines.at(-1)).toContain("medium");
    expect(lines.every((line) => stringWidth(line) <= composer.width)).toBe(true);
  });

  it("shades the full blank rows around an empty prompt", () => {
    const props = { ...composer, value: "", cursor: 0 };
    const lines = rawFrame(createElement(Input, props), props.width).split("\n");
    expect(lines).toHaveLength(measureComposerHeight(props));
    expect(stripVTControlCharacters(lines[1])).toContain("Ask anything");
    for (const index of [0, 2]) {
      const line = stripVTControlCharacters(lines[index]);
      expect(line.trimEnd()).toBe("┃");
      if (/\u001b\[/u.test(lines[1])) expect(stringWidth(line)).toBe(props.width);
    }
  });

  it("keeps wrapped drafts, queued status and settings within a narrow terminal", () => {
    const props = {
      ...composer, width: 20, queued: "Review the remaining files",
      model: "gpt-6.1-terra-with-a-long-name",
    };
    const lines = frame(createElement(Input, props), props.width);
    expect(lines).toHaveLength(measureComposerHeight(props));
    expect(lines[0].trimEnd()).toBe("┃");
    expect(lines.join("\n")).toContain("检查这个中文路径");
    expect(lines.at(-2)).toContain("Plan");
    expect(lines.at(-2)).toContain("medium");
    expect(lines.at(-1)).toContain("Queued");
    expect(lines.every((line) => stringWidth(line) <= props.width)).toBe(true);
  });

  it("gives a short welcome view entirely to the expanded composer", () => {
    const props = { ...composer, width: 46, compact: true };
    const rows = measureComposerHeight(props);
    const lines = frame(createElement(Welcome, { columns: 50, rows, composerHeight: rows },
      createElement(Input, props)), 50);
    expect(rows).toBe(3);
    expect(lines).toHaveLength(rows);
    expect(lines.some((line) => line.includes("┃") && line.includes("检查这个中文路径"))).toBe(true);
    expect(lines.join("\n")).not.toContain("Dicode");
  });

  it("shows project context and OpenCode-style command hints in the session footer", () => {
    const status = { status: "ready", running: false, columns: 96, projectPath: "C:\\work\\dicode" } as const;
    const visible = frame(createElement(StatusBar, status), status.columns);
    const dialog = frame(createElement(StatusBar, { ...status, inputVisible: false }), status.columns);
    expect(visible).toHaveLength(1);
    expect(visible[0]).toContain("C:/work/dicode");
    expect(visible[0]).toContain("ctrl+p commands");
    expect(dialog).toHaveLength(1);
    expect(dialog[0]).toContain("Esc Back");
    expect(dialog[0]).toContain("C:/work/dicode");
    expect(dialog[0]).not.toContain("Enter Send");
  });

  it("shows a low-left spinner, current operation and interrupt hint", () => {
    const lines = frame(createElement(StatusBar, {
      status: "running", running: true, columns: 100,
      projectPath: "C:\\work\\dicode", activity: "Running command…",
    }), 100);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("Running command…");
    expect(lines[0]).toContain("esc interrupt");
    expect(lines[0]).toContain("C:/work/dicode");
    expect(lines[0]).toMatch(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/u);
  });

  it("renders slash suggestions as command and description columns without a separate palette", () => {
    const lines = frame(createElement(Picker, {
      title: "Commands",
      items: [{ id: "agents", label: "/agents", detail: "Switch agent" }, { id: "diff", label: "/diff", detail: "Open diff viewer" }],
      selectedIndex: 0,
      rows: 2,
      empty: "No matches",
      inline: true,
      autocomplete: true,
      width: 75,
    }), 75);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("/agents");
    expect(lines[0]).toContain("Switch agent");
    expect(lines[1]).toContain("/diff");
    expect(lines[1]).toContain("Open diff viewer");
    expect(lines.join("\n")).not.toContain("Commands");
  });
});
