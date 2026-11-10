import { useRef } from "react";
import { useInput, type Key } from "ink";

const pasteStart = /^\u001b?\[200~/u;
const pasteEnd = /\u001b\[201~|^\[201~/u;

export function useTerminalInput(handler: (input: string, key: Key, pasted: boolean) => void) {
  const paste = useRef<string | null>(null);
  useInput((input, key) => {
    const chunk = input.replace(pasteStart, "");
    if (chunk !== input) paste.current = "";
    if (paste.current === null) {
      handler(input, key, false);
      return;
    }
    const end = pasteEnd.exec(chunk);
    if (end) {
      const text = paste.current + chunk.slice(0, end.index);
      paste.current = null;
      handler(text, {
        upArrow: false, downArrow: false, leftArrow: false, rightArrow: false, pageUp: false, pageDown: false,
        return: false, escape: false, ctrl: false, shift: false, tab: false, backspace: false, delete: false, meta: false,
      }, true);
    } else {
      paste.current += key.tab ? "\t" : key.return ? "\r" : input === chunk && key.ctrl ? "" : chunk;
    }
  });
}
