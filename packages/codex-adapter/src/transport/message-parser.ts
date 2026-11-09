/**
 * Newline-delimited framing for the stdio protocol channel.
 *
 * The App Server writes one JSON object per line, but a single `data` event
 * may carry a partial message, or many messages at once. This framer buffers
 * bytes and emits only complete lines, enforcing a maximum message size so a
 * runaway stream cannot exhaust memory.
 */

export interface LineFramerOptions {
  maxLineBytes?: number;
  onLine: (line: string) => void;
  onError?: (error: Error) => void;
}

export class LineFramer {
  private buffer = "";
  private readonly maxLineBytes: number;
  private readonly onLine: (line: string) => void;
  private readonly onError?: (error: Error) => void;

  constructor(options: LineFramerOptions) {
    this.maxLineBytes = options.maxLineBytes ?? 16 * 1024 * 1024;
    this.onLine = options.onLine;
    this.onError = options.onError;
  }

  push(chunk: string | Buffer): void {
    const text = typeof chunk === "string" ? chunk : chunk.toString("utf8");
    this.buffer += text;

    let newlineIndex = this.buffer.indexOf("\n");
    while (newlineIndex !== -1) {
      const rawLine = this.buffer.slice(0, newlineIndex);
      this.buffer = this.buffer.slice(newlineIndex + 1);
      const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
      if (line.length > 0) {
        this.onLine(line);
      }
      newlineIndex = this.buffer.indexOf("\n");
    }

    if (this.buffer.length > this.maxLineBytes) {
      const error = new Error(
        `protocol line exceeded maximum size (${this.buffer.length} > ${this.maxLineBytes})`,
      );
      this.buffer = "";
      if (this.onError) this.onError(error);
      else throw error;
    }
  }

  reset(): void {
    this.buffer = "";
  }
}
