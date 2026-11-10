import { describe, expect, it } from "vitest";
import { composerLines, editComposer, fileCompletion, moveBetweenLines } from "../../../packages/tui/src/utils/composer.js";
import { findCommand, findLeaderCommand } from "../../../packages/tui/src/utils/commands.js";
import { resolveKeyAction } from "../../../packages/tui/src/utils/keyboard.js";

const context = { running: true, modalOpen: false, inputFocused: true };

describe("OpenCode-style composer", () => {
  it("preserves normal approval shortcut letters in a prompt", () => {
    expect(resolveKeyAction({ input: "a" }, context)).toBe("none");
    expect(resolveKeyAction({ input: "d" }, context)).toBe("none");
    expect(editComposer("ab", 1, { input: "d" })).toEqual({ value: "adb", cursor: 2 });
  });

  it("moves and erases Unicode graphemes as a unit", () => {
    const emoji = "👩🏽‍💻";
    const text = `中${emoji}文`;
    const cursor = 1 + emoji.length;
    expect(editComposer(text, cursor, { key: { leftArrow: true } }).cursor).toBe(1);
    expect(editComposer(text, cursor, { key: { delete: true } })).toEqual({ value: "中文", cursor: 1 });
  });

  it("retains only visible rows and wraps using CJK cell widths", () => {
    expect(composerLines("中文中", 3, 5, 2)).toEqual([
      { before: "中文", after: "" },
      { before: "中", cursor: " ", after: "" },
    ]);
    expect(moveBetweenLines("中文\nA😀B", 2, 1)).toBe("中文\nA😀".length);
  });

  it("completes only the active at-mention at the cursor", () => {
    expect(fileCompletion("检查 @src/fo 然后运行测试", 10)).toEqual({ query: "src/fo", start: 3 });
    expect(fileCompletion("name@example.com", 16)).toBeNull();
  });

  it("routes modal, leader, agent, and multiline keys independently", () => {
    expect(resolveKeyAction({ key: { escape: true } }, context)).toBe("cancel");
    expect(resolveKeyAction({ key: { escape: true } }, { ...context, modalOpen: true })).toBe("close");
    expect(resolveKeyAction({ key: { tab: true, shift: true } }, context)).toBe("cycleAgent");
    expect(resolveKeyAction({ key: { tab: true } }, context)).toBe("complete");
    expect(resolveKeyAction({ input: "\n" }, context)).toBe("newline");
    expect(resolveKeyAction({ input: "x", key: { ctrl: true } }, context)).toBe("leader");
    expect(findLeaderCommand("l")).toBe(findCommand("resume")?.name);
    expect(findCommand("clear")?.name).toBe("new");
  });
});
