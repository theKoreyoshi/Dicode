import { describe, expect, it } from "vitest";
import { resolveKeyAction } from "@dicode/tui";

const ctx = { running: false, modalOpen: false, inputFocused: true };

describe("resolveKeyAction", () => {
  it("maps enter to send", () => {
    expect(resolveKeyAction({ input: "\r", key: { return: true } }, ctx)).toBe("send");
  });

  it("maps shift+enter to newline", () => {
    expect(resolveKeyAction({ key: { return: true, shift: true } }, ctx)).toBe("newline");
  });

  it("maps ctrl+c to cancel only while running", () => {
    expect(resolveKeyAction({ input: "c", key: { ctrl: true } }, { ...ctx, running: true })).toBe("cancel");
    expect(resolveKeyAction({ input: "c", key: { ctrl: true } }, ctx)).toBe("none");
  });

  it("maps ctrl+q to quit", () => {
    expect(resolveKeyAction({ input: "q", key: { ctrl: true } }, ctx)).toBe("quit");
  });

  it("maps ctrl+p to command palette", () => {
    expect(resolveKeyAction({ input: "p", key: { ctrl: true } }, ctx)).toBe("commandPalette");
  });

  it("maps escape to close when a modal is open", () => {
    expect(resolveKeyAction({ key: { escape: true } }, { ...ctx, modalOpen: true })).toBe("close");
  });

  it("returns none for ordinary characters (IME-safe)", () => {
    expect(resolveKeyAction({ input: "你" }, ctx)).toBe("none");
  });
});
