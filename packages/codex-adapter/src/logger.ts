/**
 * Minimal structured logger for the adapter.
 *
 * Invariants:
 * - Diagnostics go to a rolling file, away from the interactive terminal.
 * - Sensitive values (tokens, authorization headers) are redacted.
 * - Very large payloads are truncated before being written.
 * - Raw protocol frames are logged only in debug mode.
 */

import { appendFileSync, existsSync, mkdirSync, renameSync, statSync } from "node:fs";
import { join } from "node:path";
import { getLogsDir } from "@dicode/shared";

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
const SENSITIVE_FIELD = /^(?:authorization|(?:access|refresh|id)[_-]?token|token|(?:openai[_-]?)?api[_-]?key|password)$/iu;

function redact(text: string): string {
  let out = text;
  for (const [pattern, replacement] of SENSITIVE_PATTERNS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

function truncate(text: string, max = 2000): string {
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
  private readonly maxFileBytes: number;
  private readonly logPath: string | null;

  constructor(options: LoggerOptions = {}) {
    this.level = options.level ?? "info";
    this.maxFileBytes = options.maxFileBytes ?? 5 * 1024 * 1024;
    this.logPath = null;
    if (options.file === false) return;
    const directory = options.logDir ?? getLogsDir();
    try {
      mkdirSync(directory, { recursive: true });
      this.logPath = join(directory, "adapter.log");
    } catch {
      // A read-only log directory must not prevent startup.
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
      message: truncate(redact(message)),
      ...(fields ? { fields: sanitizeFields(fields) } : {}),
    };
    const line = safeStringify(entry);
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

function sanitizeFields(fields: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [
    key,
    SENSITIVE_FIELD.test(key) ? "[REDACTED]" : typeof value === "string" ? truncate(redact(value), 500) : value,
  ]));
}

export const logger = new Logger();
