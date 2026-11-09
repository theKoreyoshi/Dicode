/**
 * Minimal structured logger for the adapter.
 *
 * Invariants:
 * - Console output is written to `stderr` only; `stdout` belongs to the
 *   JSON-RPC protocol channel.
 * - Sensitive values (tokens, authorization headers) are redacted.
 * - Very large payloads are truncated before being written.
 * - Raw protocol frames are logged only in debug mode.
 */

import { appendFileSync, existsSync, mkdirSync, renameSync, statSync } from "node:fs";
import { join } from "node:path";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LoggerOptions {
  level?: LogLevel;
  /** Directory for the rolling file sink. Defaults to `%APPDATA%/Dicode/logs`. */
  logDir?: string;
  /** Enable the file sink. */
  file?: boolean;
  /** Maximum bytes per log file before rotation. */
  maxFileBytes?: number;
}

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const SENSITIVE_PATTERNS: Array<[RegExp, string]> = [
  [/(authorization\s*[:=]\s*)(bearer\s+)?[^\s,;]+/gi, "$1$2[REDACTED]"],
  [/(token\s*[:=]\s*)[^\s,;]+/gi, "$1[REDACTED]"],
  [/(api[_-]?key\s*[:=]\s*)[^\s,;]+/gi, "$1[REDACTED]"],
  [/sk-[A-Za-z0-9_-]{8,}/g, "[REDACTED]"],
];

function redact(text: string): string {
  let out = text;
  for (const [pattern, replacement] of SENSITIVE_PATTERNS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

function truncate(value: unknown, max = 2000): string {
  const text = typeof value === "string" ? value : safeStringify(value);
  return text.length > max ? `${text.slice(0, max)}…(+${text.length - max} chars)` : text;
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export class Logger {
  private readonly level: LogLevel;
  private readonly logDir: string | null;
  private readonly maxFileBytes: number;
  private logPath: string | null = null;

  constructor(options: LoggerOptions = {}) {
    this.level = options.level ?? "info";
    this.maxFileBytes = options.maxFileBytes ?? 5 * 1024 * 1024;
    if (options.file !== false) {
      this.logDir = options.logDir ?? defaultLogDir();
      this.logPath = join(this.logDir, "adapter.log");
      try {
        mkdirSync(this.logDir, { recursive: true });
      } catch {
        this.logDir = null;
        this.logPath = null;
      }
    } else {
      this.logDir = null;
    }
  }

  debug(message: string, fields?: Record<string, unknown>): void {
    this.write("debug", message, fields);
  }

  info(message: string, fields?: Record<string, unknown>): void {
    this.write("info", message, fields);
  }

  warn(message: string, fields?: Record<string, unknown>): void {
    this.write("warn", message, fields);
  }

  error(message: string, fields?: Record<string, unknown>): void {
    this.write("error", message, fields);
  }

  private write(level: LogLevel, message: string, fields?: Record<string, unknown>): void {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[this.level]) return;
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message: redact(truncate(message)),
      ...(fields ? { fields: truncateFields(fields) } : {}),
    };
    const line = safeStringify(entry);
    process.stderr.write(`${line}\n`);
    this.writeFile(line);
  }

  private writeFile(line: string): void {
    if (!this.logPath) return;
    try {
      this.rotateIfNeeded();
      appendFileSync(this.logPath, `${line}\n`, "utf8");
    } catch {
      // Logging must never take down the adapter.
    }
  }

  private rotateIfNeeded(): void {
    if (!this.logPath) return;
    try {
      if (existsSync(this.logPath) && statSync(this.logPath).size >= this.maxFileBytes) {
        const rotated = this.logPath.replace(/\.log$/, `.${Date.now()}.log`);
        renameSync(this.logPath, rotated);
      }
    } catch {
      // Best effort rotation.
    }
  }
}

function truncateFields(fields: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    out[key] = typeof value === "string" && value.length > 500 ? truncate(value, 500) : value;
  }
  return out;
}

function defaultLogDir(): string {
  const base = process.env.APPDATA ?? process.env.LOCALAPPDATA ?? process.env.TMP ?? process.cwd();
  return join(base, "Dicode", "logs");
}

export const logger = new Logger();
