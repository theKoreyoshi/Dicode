import type { EventEmitter } from "node:events";
import { useEffect, useRef } from "react";
import { useInput, useStdin, type Key } from "ink";

const escape = "\u001b";
const pasteStart = `${escape}[200~`;
const pasteEnd = `${escape}[201~`;
const sgrStart = `${escape}[<`;
const legacyStart = `${escape}[M`;
const sgrMouse = /^\u001b\[<(\d{1,8});\d{1,8};\d{1,8}([Mm])/u;
const csiKey = /^\u001b+\[\[?[0-?]*[ -/]*[@-~]/u;
const rxvtKey = /^\u001b+\[\d+(?:;\d+)?[\^$]/u;
const ss3Key = /^\u001b+[ON][ -~]/u;
const partialKey = /^\u001b+(?:\[\[?[0-?]*[ -/]*|[ON])?$/u;
const metaKey = /^\u001b+[^\u001b]?/u;
const plainControl = /[\u0000-\u001f\u007f]/gu;
const pasteEvent = Symbol("dicode terminal paste");
const wheelEvent = Symbol("dicode terminal wheel");
const escapeDelay = 35;

const plainKey: Key = {
  upArrow: false, downArrow: false, leftArrow: false, rightArrow: false, pageUp: false, pageDown: false,
  return: false, escape: false, ctrl: false, shift: false, tab: false, backspace: false, delete: false, meta: false,
};

type WheelDirection = -1 | 1;

export function useTerminalInput(
  handler: (input: string, key: Key, pasted: boolean) => void,
  onWheel?: (direction: WheelDirection) => void,
) {
  const { internal_eventEmitter: emitter } = useStdin();
  const handlerRef = useRef(handler);
  const wheelRef = useRef(onWheel);
  handlerRef.current = handler;
  wheelRef.current = onWheel;

  useEffect(() => {
    if (!emitter) return;
    const release = retainTerminalInput(emitter);
    const receivePaste = (text: string) => handlerRef.current(text, plainKey, true);
    const receiveWheel = (direction: WheelDirection) => wheelRef.current?.(direction);
    emitter.on(pasteEvent, receivePaste);
    emitter.on(wheelEvent, receiveWheel);
    return () => {
      emitter.off(pasteEvent, receivePaste);
      emitter.off(wheelEvent, receiveWheel);
      release();
    };
  }, [emitter]);

  useInput((input, key) => handlerRef.current(input, key, false));
}

const installed = new WeakMap<EventEmitter, { users: number; remove: () => void }>();

function retainTerminalInput(emitter: EventEmitter): () => void {
  let entry = installed.get(emitter);
  if (!entry) {
    // Ink 5 parses one key per input event. Split raw packets before useInput
    // so a mouse report cannot swallow an adjacent key or be treated as text.
    const emit = emitter.emit;
    const decoder = new TerminalInputDecoder(
      (key) => emit.call(emitter, "input", key),
      (text) => emit.call(emitter, pasteEvent, text),
      (direction) => emit.call(emitter, wheelEvent, direction),
    );
    const wrapped: EventEmitter["emit"] = function (this: EventEmitter, event, ...args) {
      const data: unknown = args[0];
      if (event !== "input" || typeof data !== "string") return emit.call(this, event, ...args);
      decoder.write(data);
      return this.listenerCount("input") > 0;
    };
    emitter.emit = wrapped;
    entry = {
      users: 0,
      remove: () => {
        decoder.dispose();
        if (emitter.emit === wrapped) emitter.emit = emit;
        installed.delete(emitter);
      },
    };
    installed.set(emitter, entry);
  }
  const registration = entry;
  registration.users++;
  return () => {
    if (--registration.users === 0) registration.remove();
  };
}

class TerminalInputDecoder {
  private pending = "";
  private paste: string | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly emitKey: (input: string) => void,
    private readonly emitPaste: (input: string) => void,
    private readonly emitWheel: (direction: WheelDirection) => void,
  ) {}

  write(chunk: string): void {
    clearTimeout(this.timer);
    let input = this.pending + chunk;
    this.pending = "";
    while (input.length > 0) {
      if (this.paste !== null) {
        const end = input.indexOf(pasteEnd);
        if (end < 0) {
          const tail = endPrefixLength(input, pasteEnd);
          this.paste += input.slice(0, input.length - tail);
          this.pending = input.slice(input.length - tail);
          return;
        }
        const text = this.paste + input.slice(0, end);
        this.paste = null;
        input = input.slice(end + pasteEnd.length);
        this.emitPaste(text);
        continue;
      }
      const nextEscape = input.indexOf(escape);
      if (nextEscape !== 0) {
        const end = nextEscape === -1 ? input.length : nextEscape;
        this.writePlain(input.slice(0, end));
        input = input.slice(end);
        continue;
      }
      if (input.startsWith(pasteStart) || input.startsWith(pasteEnd)) {
        if (input.startsWith(pasteStart)) this.paste = "";
        input = input.slice(pasteStart.length);
        continue;
      }
      if (input.startsWith(sgrStart)) {
        const report = sgrMouse.exec(input);
        if (report) {
          if (report[2] === "M") this.wheel(Number(report[1]));
          input = input.slice(report[0].length);
          continue;
        }
        const invalidReport = csiKey.exec(input)?.[0];
        if (!invalidReport && input.length <= 32 && /^\u001b\[<[\d;]*$/u.test(input)) {
          this.pending = input;
          return;
        }
        input = input.slice(invalidReport?.length ?? sgrStart.length);
        continue;
      }
      if (input.startsWith(legacyStart)) {
        const size = legacyStart.length + 3;
        if (input.length < size) {
          this.pending = input;
          return;
        }
        this.wheel(input.charCodeAt(legacyStart.length) - 32);
        input = input.slice(size);
        continue;
      }
      const terminalKey = rxvtKey.exec(input)?.[0] ?? csiKey.exec(input)?.[0] ?? ss3Key.exec(input)?.[0];
      if (!terminalKey && input.length <= 32 && partialKey.test(input)) {
        this.pending = input;
        if (/^\u001b{1,2}$/u.test(input)) this.waitForEscape();
        return;
      }
      const key = terminalKey ?? metaKey.exec(input)?.[0] ?? escape;
      this.emitKey(key);
      input = input.slice(key.length);
    }
  }

  dispose(): void {
    clearTimeout(this.timer);
  }

  private waitForEscape(): void {
    this.timer = setTimeout(() => {
      const key = this.pending;
      this.pending = "";
      this.emitKey(key);
    }, escapeDelay);
  }

  private writePlain(text: string): void {
    // Older terminals may paste multiline text without sending bracket markers.
    if (/[\t\r\n]/u.test(text) && /[^\u0000-\u001f\u007f]/u.test(text)) {
      this.emitKey(text);
      return;
    }
    let offset = 0;
    for (const control of text.matchAll(plainControl)) {
      if (control.index > offset) this.emitKey(text.slice(offset, control.index));
      this.emitKey(control[0]);
      offset = control.index + 1;
    }
    if (offset < text.length) this.emitKey(text.slice(offset));
  }

  private wheel(button: number): void {
    if (button < 0 || button > 255) return;
    const unmodified = button & ~0b00011100;
    if (unmodified === 64) this.emitWheel(-1);
    if (unmodified === 65) this.emitWheel(1);
  }
}

function endPrefixLength(input: string, marker: string): number {
  for (let length = Math.min(input.length, marker.length - 1); length > 0; length--) {
    if (input.endsWith(marker.slice(0, length))) return length;
  }
  return 0;
}
