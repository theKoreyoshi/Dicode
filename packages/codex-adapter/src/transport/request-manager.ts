import { RpcTimeoutError, RpcResponseError } from "../errors/adapter-errors.js";
import type { JsonRpcId } from "@dicode/shared";

export interface PendingRequest {
  id: string;
  method: string;
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
  settled: boolean;
}

export interface RequestManagerOptions {
  defaultTimeoutMs?: number;
}

export interface CreatedRequest {
  id: string;
  promise: Promise<unknown>;
}

const DEFAULT_TIMEOUT_MS = 60_000;

/**
 * Correlates JSON-RPC requests with their responses, enforces per-request
 * timeouts, and rejects all in-flight requests when the connection drops.
 */
export class RequestManager {
  private readonly defaultTimeoutMs: number;
  private readonly pending = new Map<string, PendingRequest>();
  private nextId = 1;

  constructor(options: RequestManagerOptions = {}) {
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  create(method: string, timeoutMs?: number): CreatedRequest {
    const id = `dicode-${this.nextId++}`;
    let resolve!: (result: unknown) => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<unknown>((res, rej) => {
      resolve = res;
      reject = rej;
    });

    const entry: PendingRequest = {
      id,
      method,
      resolve,
      reject,
      settled: false,
      timer: setTimeout(() => this.timeout(id), timeoutMs ?? this.defaultTimeoutMs),
    };
    this.pending.set(id, entry);
    return { id, promise };
  }

  resolve(id: JsonRpcId, result: unknown): boolean {
    const entry = this.lookup(id);
    if (!entry) return false;
    entry.settled = true;
    clearTimeout(entry.timer);
    this.pending.delete(entry.id);
    entry.resolve(result);
    return true;
  }

  rejectWithError(id: JsonRpcId, error: Error): boolean {
    const entry = this.lookup(id);
    if (!entry) return false;
    entry.settled = true;
    clearTimeout(entry.timer);
    this.pending.delete(entry.id);
    entry.reject(error);
    return true;
  }

  rejectWithRpcError(id: JsonRpcId, code: number, message: string, data?: unknown): boolean {
    return this.rejectWithError(id, new RpcResponseError(code, message, { cause: data }));
  }

  failAll(error: Error): void {
    for (const entry of [...this.pending.values()]) {
      entry.settled = true;
      clearTimeout(entry.timer);
      entry.reject(error);
    }
    this.pending.clear();
  }

  cancel(id: JsonRpcId): boolean {
    const entry = this.lookup(id);
    if (!entry) return false;
    entry.settled = true;
    clearTimeout(entry.timer);
    this.pending.delete(entry.id);
    entry.reject(new Error(`request cancelled: ${entry.method}`));
    return true;
  }

  get pendingCount(): number {
    return this.pending.size;
  }

  private timeout(id: string): void {
    const entry = this.pending.get(id);
    if (!entry) return;
    entry.settled = true;
    this.pending.delete(id);
    entry.reject(new RpcTimeoutError(`request timed out after no response: ${entry.method}`));
  }

  private lookup(id: JsonRpcId): PendingRequest | undefined {
    return this.pending.get(String(id));
  }
}
