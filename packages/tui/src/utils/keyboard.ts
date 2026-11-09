export interface KeyEvent {
  input?: string;
  key?: {
    upArrow?: boolean;
    downArrow?: boolean;
    leftArrow?: boolean;
    rightArrow?: boolean;
    return?: boolean;
    escape?: boolean;
    pageDown?: boolean;
    pageUp?: boolean;
    backspace?: boolean;
    ctrl?: boolean;
    shift?: boolean;
  };
}

export type KeyAction =
  | "send"
  | "newline"
  | "quit"
  | "newSession"
  | "commandPalette"
  | "toggleSidebar"
  | "cancel"
  | "close"
  | "historyUp"
  | "historyDown"
  | "scrollUp"
  | "scrollDown"
  | "approve"
  | "deny"
  | "none";

/**
 * Maps a raw Ink key event to a single Dicode action. Returns `none` for
 * characters (which feed the text input), including CJK IME composition.
 */
export function resolveKeyAction(event: KeyEvent, context: { running: boolean; modalOpen: boolean; inputFocused: boolean }): KeyAction {
  const k = event.key ?? {};
  const ch = event.input ?? "";

  // Escape closes overlays first.
  if (k.escape) return context.modalOpen ? "close" : "none";

  if (k.ctrl) {
    if (ch === "c") return context.running ? "cancel" : "none";
    if (ch === "n") return "newSession";
    if (ch === "p") return "commandPalette";
    if (ch === "b") return "toggleSidebar";
    if (ch === "q") return "quit";
  }

  if (k.return) {
    return k.shift ? "newline" : "send";
  }

  if (k.upArrow) return "historyUp";
  if (k.downArrow) return "historyDown";
  if (k.pageUp) return "scrollUp";
  if (k.pageDown) return "scrollDown";

  if (ch === "a" || ch === "A") return "approve";
  if (ch === "d" || ch === "D") return "deny";

  return "none";
}
