import { PassThrough } from "node:stream";
import { setImmediate } from "node:timers/promises";
import { render, type Key } from "ink";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { useTerminalInput } from "../../../packages/tui/src/app/useTerminalInput.js";

function terminal() {
  const stdout = Object.assign(new PassThrough(), { columns: 80, rows: 25 }) as unknown as NodeJS.WriteStream;
  const stdin = Object.assign(new PassThrough(), {
    isTTY: true,
    setRawMode: () => {},
    ref: () => {},
    unref: () => {},
  }) as unknown as NodeJS.ReadStream;
  const keys = vi.fn<(text: string, key: Key, pasted: boolean) => void>();
  const approvalKeys = vi.fn<(text: string, key: Key, pasted: boolean) => void>();
  const wheel = vi.fn<(direction: -1 | 1) => void>();
  function Probe() {
    useTerminalInput(keys, wheel);
    useTerminalInput(approvalKeys);
    return null;
  }
  const app = render(createElement(Probe), { stdin, stdout, debug: true, patchConsole: false, exitOnCtrlC: false });
  return { app, stdin, keys, approvalKeys, wheel };
}

const esc = "\u001b";

describe("terminal mouse input", () => {
  it("dispatches wheel direction independently of keys and discards clicks and releases", async () => {
    const { app, stdin, keys, approvalKeys, wheel } = terminal();
    try {
      await vi.waitFor(() => expect(stdin.listenerCount("readable")).toBeGreaterThan(0));
      stdin.push(`hello${esc}[<64;12;4M${esc}[5~${esc}[<0;2;4M${esc}[<0;2;4m${esc}[<65;12;4m世界${esc}[<0;2;4m\r`);
      await vi.waitFor(() => expect(keys).toHaveBeenCalledTimes(4));
      expect(wheel.mock.calls).toEqual([[-1]]);
      expect(keys.mock.calls[0]).toEqual(["hello", expect.objectContaining({ ctrl: false }), false]);
      expect(keys.mock.calls[1]).toEqual(["", expect.objectContaining({ pageUp: true }), false]);
      expect(keys.mock.calls[2][0]).toBe("世界");
      expect(keys.mock.calls[3][1].return).toBe(true);
      expect(approvalKeys.mock.calls).toEqual(keys.mock.calls);
    } finally {
      app.unmount();
    }
  });

  it("handles fragmented and back-to-back SGR reports and preserves Ctrl+C", async () => {
    const { app, stdin, keys, wheel } = terminal();
    try {
      await vi.waitFor(() => expect(stdin.listenerCount("readable")).toBeGreaterThan(0));
      stdin.push(esc);
      await setImmediate();
      stdin.push("[<6");
      await setImmediate();
      stdin.push(`5;14;8M${esc}[<68;14;8M\u0003`);
      await vi.waitFor(() => expect(wheel.mock.calls).toEqual([[1], [-1]]));
      expect(keys).toHaveBeenCalledTimes(1);
      expect(keys).toHaveBeenCalledWith("c", expect.objectContaining({ ctrl: true }), false);
      stdin.push(esc);
      await vi.waitFor(() => expect(keys.mock.calls.at(-1)?.[1].escape).toBe(true));
      stdin.push(`${esc}\u007f`);
      await vi.waitFor(() => expect(keys.mock.calls.at(-1)?.[1]).toMatchObject({ delete: true, meta: true, escape: false }));
    } finally {
      app.unmount();
    }
  });

  it("passes a fragmented bracketed paste as text without scrolling or invoking shortcuts", async () => {
    const { app, stdin, keys, wheel } = terminal();
    try {
      await vi.waitFor(() => expect(stdin.listenerCount("readable")).toBeGreaterThan(0));
      stdin.push(`${esc}[20`);
      await setImmediate();
      const pasted = `line one\r\nline two\t${esc}[<64;12;4M`;
      stdin.push(`0~${pasted}${esc}[20`);
      await setImmediate();
      stdin.push(`1~${esc}[<65;12;4M`);
      await vi.waitFor(() => expect(keys).toHaveBeenCalledTimes(1));
      expect(keys).toHaveBeenCalledWith(pasted, expect.objectContaining({ return: false, ctrl: false }), true);
      expect(wheel.mock.calls).toEqual([[1]]);
    } finally {
      app.unmount();
    }
  });

  it("does not turn unbracketed multiline text into submit or tab shortcuts", async () => {
    const { app, stdin, keys, wheel } = terminal();
    try {
      await vi.waitFor(() => expect(stdin.listenerCount("readable")).toBeGreaterThan(0));
      const text = "first line\r\nsecond line\tend";
      stdin.push(`${esc}[<64;1;1M${text}`);
      await vi.waitFor(() => expect(keys).toHaveBeenCalledTimes(1));
      expect(keys).toHaveBeenCalledWith(text, expect.objectContaining({ return: false, tab: false }), false);
      expect(wheel.mock.calls).toEqual([[-1]]);
    } finally {
      app.unmount();
    }
  });

  it("accepts legacy X10 wheel reports without allowing mouse bytes into keyboard listeners", async () => {
    const { app, stdin, keys, wheel } = terminal();
    try {
      await vi.waitFor(() => expect(stdin.listenerCount("readable")).toBeGreaterThan(0));
      stdin.push(`${esc}[M`);
      await setImmediate();
      stdin.push(`${String.fromCharCode(97, 39, 41)}${esc}[M${String.fromCharCode(32, 39, 41)}`);
      await vi.waitFor(() => expect(wheel.mock.calls).toEqual([[1]]));
      expect(keys).not.toHaveBeenCalled();
    } finally {
      app.unmount();
    }
  });
});
