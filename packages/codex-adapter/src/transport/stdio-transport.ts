import type { Readable, Writable } from "node:stream";
import type { Logger } from "../logger.js";
import { LineFramer } from "./message-parser.js";

/** A decoded (but not yet classified) protocol message from the wire. */
export interface WireMessage {
  id?: unknown;
  method?: unknown;
  params?: unknown;
  result?: unknown;
  error?: unknown;
  jsonrpc?: unknown;
}

export interface StdioTransportOptions {
  stdin: Writable;
  stdout: Readable;
  stderr?: Readable;
  logger?: Logger;
  maxLineBytes?: number;
}

/**
 * Wires the child process stdio streams into the protocol layer. `stdout` is
 * framed into newline-delimited messages; `stderr` is forwarded to the logger.
 */
export class StdioTransport {
  private readonly stdin: Writable;
  private readonly logger?: Logger;
  private readonly framer: LineFramer;
  private messageHandler: ((message: WireMessage) => void) | null = null;
  private errorHandler: ((error: Error) => void) | null = null;
  private stderrListener: ((chunk: Buffer) => void) | null = null;

  constructor(options: StdioTransportOptions) {
    this.stdin = options.stdin;
    this.logger = options.logger;

    this.framer = new LineFramer({
      maxLineBytes: options.maxLineBytes,
      onLine: (line) => this.handleLine(line),
      onError: (error) => this.errorHandler?.(error),
    });

    options.stdout.on("data", this.onStdoutData);
    options.stdout.on("error", this.onStreamError);

    if (options.stderr) {
      this.stderrListener = (chunk: Buffer) => {
        this.logger?.debug(`app-server stderr: ${chunk.toString("utf8").trimEnd()}`);
      };
      options.stderr.on("data", this.stderrListener);
    }
  }

  onMessage(handler: (message: WireMessage) => void): () => void {
    this.messageHandler = handler;
    return () => {
      this.messageHandler = null;
    };
  }

  onError(handler: (error: Error) => void): () => void {
    this.errorHandler = handler;
    return () => {
      this.errorHandler = null;
    };
  }

  write(message: WireMessage): void {
    this.stdin.write(`${JSON.stringify(message)}\n`);
  }

  close(): void {
    this.framer.reset();
  }

  private readonly onStdoutData = (chunk: Buffer): void => {
    this.framer.push(chunk);
  };

  private readonly onStreamError = (error: Error): void => {
    this.errorHandler?.(error);
  };

  private handleLine(line: string): void {
    let message: WireMessage;
    try {
      message = JSON.parse(line) as WireMessage;
    } catch (error) {
      this.errorHandler?.(error instanceof Error ? error : new Error(String(error)));
      return;
    }
    this.messageHandler?.(message);
  }
}
