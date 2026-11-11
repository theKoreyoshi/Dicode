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
  providerSecret?: string;
}

/**
 * Wires the child process stdio streams into the protocol layer. `stdout` is
 * framed into newline-delimited messages; `stderr` is forwarded to the logger.
 */
export class StdioTransport {
  private readonly stdin: Writable;
  private readonly logger?: Logger;
  private readonly framer: LineFramer;
  private readonly providerSecret?: string;
  private messageHandler: ((message: WireMessage) => void) | null = null;
  private errorHandler: ((error: Error) => void) | null = null;
  private stderrListener: ((chunk: Buffer) => void) | null = null;

  constructor(options: StdioTransportOptions) {
    this.stdin = options.stdin;
    this.logger = options.logger;
    this.providerSecret = options.providerSecret;

    this.framer = new LineFramer({
      maxLineBytes: options.maxLineBytes,
      onLine: (line) => this.handleLine(line),
      onError: (error) => this.errorHandler?.(error),
    });

    options.stdout.on("data", this.onStdoutData);
    options.stdout.on("error", this.onStreamError);

    if (options.stderr) {
      if (this.providerSecret) {
        // Keep the pipe flowing without recording gateway diagnostics that may
        // contain a reflected credential split across stderr chunks.
        options.stderr.resume();
      } else {
        this.stderrListener = (chunk: Buffer) => {
          this.logger?.debug(`app-server stderr: ${chunk.toString("utf8").trimEnd()}`);
        };
        options.stderr.on("data", this.stderrListener);
      }
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
    if (this.providerSecret) redactProviderErrors(message, this.providerSecret);
    this.messageHandler?.(message);
  }
}

function redactProviderErrors(message: WireMessage, secret: string): void {
  redactField(message, "error", secret);
  const params = asRecord(message.params);
  if (message.method === "error") redactField(params, "error", secret);
  if (message.method === "warning") redactField(params, "message", secret);
  redactField(asRecord(params?.turn), "error", secret);
  redactField(asRecord(asRecord(message.result)?.turn), "error", secret);
}

function redactField(record: Record<string, unknown> | WireMessage | undefined, key: string, secret: string): void {
  if (record && key in record) {
    const fields = record as Record<string, unknown>;
    fields[key] = redactValue(fields[key], secret);
  }
}

function redactValue(value: unknown, secret: string): unknown {
  if (typeof value === "string") return value.replaceAll(secret, "[redacted]");
  if (Array.isArray(value)) return value.map((part) => redactValue(part, secret));
  const record = asRecord(value);
  return record
    ? Object.fromEntries(Object.entries(record).map(([key, part]) => [key, redactValue(part, secret)]))
    : value;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : undefined;
}
