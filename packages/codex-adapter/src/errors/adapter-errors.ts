/**
 * Unified error hierarchy for the Codex Adapter. These errors are stable and
 * safe to surface to the Core/TUI; they never leak raw protocol or credentials.
 */

export type AdapterErrorCode =
  | "RUNTIME_NOT_FOUND"
  | "PROCESS_START"
  | "PROCESS_EXIT"
  | "PROTOCOL"
  | "RPC_TIMEOUT"
  | "RPC_RESPONSE"
  | "THREAD"
  | "TURN"
  | "APPROVAL"
  | "CONNECTION"
  | "NOT_READY"
  | "UNSUPPORTED";

export class AdapterError extends Error {
  readonly code: AdapterErrorCode;
  readonly cause?: unknown;

  constructor(code: AdapterErrorCode, message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.cause = options?.cause;
  }
}

export class RuntimeNotFoundError extends AdapterError {
  constructor(message: string, options?: { cause?: unknown }) {
    super("RUNTIME_NOT_FOUND", message, options);
  }
}

export class ProcessStartError extends AdapterError {
  constructor(message: string, options?: { cause?: unknown }) {
    super("PROCESS_START", message, options);
  }
}

export class ProcessExitError extends AdapterError {
  constructor(message: string, options?: { cause?: unknown }) {
    super("PROCESS_EXIT", message, options);
  }
}

export class ProtocolError extends AdapterError {
  constructor(message: string, options?: { cause?: unknown }) {
    super("PROTOCOL", message, options);
  }
}

export class RpcTimeoutError extends AdapterError {
  constructor(message: string, options?: { cause?: unknown }) {
    super("RPC_TIMEOUT", message, options);
  }
}

export class RpcResponseError extends AdapterError {
  readonly rpcCode: number;

  constructor(rpcCode: number, message: string, options?: { cause?: unknown }) {
    super("RPC_RESPONSE", message, options);
    this.rpcCode = rpcCode;
  }
}

export class ThreadError extends AdapterError {
  constructor(message: string, options?: { cause?: unknown }) {
    super("THREAD", message, options);
  }
}

export class TurnError extends AdapterError {
  constructor(message: string, options?: { cause?: unknown }) {
    super("TURN", message, options);
  }
}

export class ApprovalError extends AdapterError {
  constructor(message: string, options?: { cause?: unknown }) {
    super("APPROVAL", message, options);
  }
}

export class AdapterConnectionError extends AdapterError {
  constructor(message: string, options?: { cause?: unknown }) {
    super("CONNECTION", message, options);
  }
}

export class AdapterNotReadyError extends AdapterError {
  constructor(message: string, options?: { cause?: unknown }) {
    super("NOT_READY", message, options);
  }
}

export class UnsupportedFeatureError extends AdapterError {
  constructor(message: string, options?: { cause?: unknown }) {
    super("UNSUPPORTED", message, options);
  }
}

export function isAdapterError(error: unknown): error is AdapterError {
  return error instanceof AdapterError;
}
