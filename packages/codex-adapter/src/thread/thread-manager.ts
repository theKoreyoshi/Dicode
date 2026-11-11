import { ClientMethods } from "../protocol.js";
import type { ThreadResult } from "../protocol/protocol-types.js";
import type {
  ForkThreadOptions,
  ListThreadOptions,
  ResumeThreadOptions,
  StartThreadOptions,
  ThreadInfo,
} from "./thread-types.js";

export type RequestFn = (method: string, params?: unknown) => Promise<unknown>;

export interface ThreadManager {
  start(options?: StartThreadOptions): Promise<ThreadInfo>;
  resume(threadId: string, options?: ResumeThreadOptions): Promise<ThreadInfo>;
  list(options?: ListThreadOptions): Promise<ThreadInfo[]>;
  fork(threadId: string, options?: ForkThreadOptions): Promise<ThreadInfo>;
  archive(threadId: string): Promise<void>;
}

export class CodexThreadManager implements ThreadManager {
  constructor(private readonly request: RequestFn) {}

  async start(options: StartThreadOptions = {}): Promise<ThreadInfo> {
    const params: Record<string, unknown> = {};
    if (options.cwd) params.cwd = options.cwd;
    if (options.model) params.model = options.model;
    if (options.modelProvider) params.modelProvider = options.modelProvider;
    if (options.sandbox) params.sandbox = options.sandbox;
    if (options.approvalPolicy) params.approvalPolicy = options.approvalPolicy;
    if (options.developerInstructions) params.developerInstructions = options.developerInstructions;

    const result = (await this.request(ClientMethods.threadStart, params)) as ThreadResult;
    return toThreadInfo(result.thread, result);
  }

  async resume(threadId: string, options: ResumeThreadOptions = {}): Promise<ThreadInfo> {
    const params: Record<string, unknown> = { threadId, excludeTurns: true };
    if (options.cwd) params.cwd = options.cwd;
    if (options.model) params.model = options.model;
    if (options.developerInstructions) params.developerInstructions = options.developerInstructions;

    const result = (await this.request(ClientMethods.threadResume, params)) as ThreadResult;
    return toThreadInfo(result.thread, result);
  }

  async list(options: ListThreadOptions = {}): Promise<ThreadInfo[]> {
    const params: Record<string, unknown> = {};
    if (options.limit !== undefined) params.limit = options.limit;
    if (options.cwd) params.cwd = options.cwd;
    if (options.archived !== undefined) params.archived = options.archived;
    if (options.searchTerm) params.searchTerm = options.searchTerm;

    const result = (await this.request(ClientMethods.threadList, params)) as {
      data?: unknown[];
    };
    return (result.data ?? []).map((item) => toThreadInfo(item));
  }

  async fork(threadId: string, options: ForkThreadOptions = {}): Promise<ThreadInfo> {
    const params: Record<string, unknown> = { threadId };
    if (options.cwd) params.cwd = options.cwd;
    if (options.model) params.model = options.model;

    const result = (await this.request(ClientMethods.threadFork, params)) as ThreadResult;
    return toThreadInfo(result.thread, result);
  }

  async archive(threadId: string): Promise<void> {
    await this.request(ClientMethods.threadArchive, { threadId });
  }
}

function toThreadInfo(raw: unknown, result?: ThreadResult): ThreadInfo {
  const record = (raw ?? {}) as Record<string, unknown>;
  const fallback = (result ?? {}) as Record<string, unknown>;
  return {
    id: stringOr(record.id ?? fallback.id, ""),
    title: optionalString(record.title),
    preview: optionalString(record.preview),
    cwd: nullableString(record.cwd ?? fallback.cwd),
    model: nullableString(fallback.model ?? record.model),
    modelProvider: nullableString(fallback.modelProvider ?? record.modelProvider),
    status: record.status,
    createdAt: nullableNumber(record.createdAt),
    updatedAt: nullableNumber(record.updatedAt),
  };
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function nullableString(value: unknown): string | null | undefined {
  return typeof value === "string" ? value : value == null ? null : undefined;
}

function nullableNumber(value: unknown): number | null | undefined {
  return typeof value === "number" ? value : value == null ? null : undefined;
}
