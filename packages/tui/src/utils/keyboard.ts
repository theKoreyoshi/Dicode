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
    delete?: boolean;
    tab?: boolean;
    ctrl?: boolean;
    shift?: boolean;
    meta?: boolean;
  };
}

export type KeyAction =
  | "send" | "newline" | "quit" | "newSession" | "commandPalette" | "toggleSidebar"
  | "cancel" | "close" | "historyUp" | "historyDown" | "scrollUp" | "scrollDown" | "nextSession" | "previousSession"
  | "leader" | "sessionPicker" | "cycleAgent" | "cycleEffort" | "complete" | "none";

export function resolveKeyAction(event: KeyEvent, context: { running: boolean; modalOpen: boolean; inputFocused: boolean }): KeyAction {
  const key = event.key ?? {};
  const input = event.input?.toLowerCase() ?? "";

  if (/^\u001b\[(?:9;[5-8]u|1;[56]i)$/iu.test(input)) {
    return /(?:;6u|;8u|;6i)$/iu.test(input) ? "previousSession" : "nextSession";
  }

  if (key.escape) return context.modalOpen ? "close" : context.running ? "cancel" : "none";
  if (key.ctrl) {
    if (input === "c") return context.running ? "cancel" : "none";
    if (input === "n") return "newSession";
    if (input === "p") return "commandPalette";
    if (input === "b") return "toggleSidebar";
    if (input === "q") return "quit";
    if (input === "x") return "leader";
    if (input === "o") return "sessionPicker";
    if (input === "t") return "cycleEffort";
    if (key.tab) return key.shift ? "previousSession" : "nextSession";
  }
  // Ink 5 exposes LF as input and leaves newer modified Enter sequences unparsed.
  if (input === "\n" || input === "\u000d" && key.meta || /^\[13;[2-8]u$/u.test(input)) return "newline";
  if (key.return) return key.shift || key.ctrl || key.meta ? "newline" : "send";
  if (key.tab) return key.shift ? "cycleAgent" : "complete";
  if (key.upArrow) return "historyUp";
  if (key.downArrow) return "historyDown";
  if (key.pageUp) return "scrollUp";
  if (key.pageDown) return "scrollDown";
  return "none";
}
