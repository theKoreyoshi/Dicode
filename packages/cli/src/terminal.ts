import { writeSync } from "node:fs";
import { PassThrough } from "node:stream";
import { render, type Instance } from "ink";
import { createElement } from "react";
import { App } from "@dicode/tui";

const enterScreen = "\u001b[?1049h\u001b[2J\u001b[H\u001b[?2004h\u001b[?1006h\u001b[?1000h";
const leaveScreen = "\u001b[?1000l\u001b[?1006l\u001b[?2004l\u001b[?1049l\u001b[?25h";

export async function runTerminal(cwd?: string, resume?: boolean): Promise<void> {
  const terminal = process.stdout;
  const frame = Object.defineProperties(new PassThrough(), {
    columns: { get: () => terminal.columns },
    rows: { get: () => terminal.rows },
    isTTY: { get: () => terminal.isTTY },
  }) as unknown as NodeJS.WriteStream;
  const resize = () => frame.emit("resize");

  // Disconnect the Ink stream before restoring the original screen so delayed
  // redraws cannot land in the shell, even on a process-level exit.
  const detach = () => {
    terminal.off("resize", resize);
    frame.unpipe(terminal);
    frame.resume();
  };
  const restoreOnExit = () => {
    detach();
    try {
      writeSync(terminal.fd, leaveScreen);
    } catch {
      // The terminal may already have closed.
    }
  };

  let app: Instance | undefined;
  terminal.write(enterScreen);
  frame.pipe(terminal, { end: false });
  terminal.on("resize", resize);
  process.once("exit", restoreOnExit);
  try {
    app = render(createElement(App, { cwd, resume }), { stdout: frame, exitOnCtrlC: false });
    await app.waitUntilExit();
  } finally {
    app?.unmount();
    detach();
    process.off("exit", restoreOnExit);
    if (!terminal.destroyed) terminal.write(leaveScreen);
  }
}
