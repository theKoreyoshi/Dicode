export type CoreErrorCode =
  | "CONFIG_INVALID"
  | "STORAGE_ERROR"
  | "PROJECT_NOT_FOUND"
  | "PROJECT_INVALID"
  | "SESSION_NOT_FOUND"
  | "SESSION_ALREADY_ACTIVE"
  | "TASK_NOT_FOUND"
  | "TASK_LOCKED"
  | "TASK_INVALID_TRANSITION"
  | "APPROVAL_NOT_FOUND"
  | "APPROVAL_ALREADY_RESOLVED"
  | "CAPABILITY_UNSUPPORTED"
  | "CORE_NOT_READY"
  | "INTERNAL";

export class CoreError extends Error {
  readonly code: CoreErrorCode;

  constructor(code: CoreErrorCode, message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.cause = options?.cause;
  }
}

export class ConfigError extends CoreError {
  constructor(message: string, options?: { cause?: unknown }) {
    super("CONFIG_INVALID", message, options);
  }
}

export class StorageError extends CoreError {
  constructor(message: string, options?: { cause?: unknown }) {
    super("STORAGE_ERROR", message, options);
  }
}

export class SessionError extends CoreError {
  constructor(code: CoreErrorCode, message: string, options?: { cause?: unknown }) {
    super(code, message, options);
  }
}

export class TaskError extends CoreError {
  constructor(code: CoreErrorCode, message: string, options?: { cause?: unknown }) {
    super(code, message, options);
  }
}

export class ProjectError extends CoreError {
  constructor(code: CoreErrorCode, message: string, options?: { cause?: unknown }) {
    super(code, message, options);
  }
}

export class ApprovalError extends CoreError {
  constructor(code: CoreErrorCode, message: string, options?: { cause?: unknown }) {
    super(code, message, options);
  }
}

export class UnsupportedCapabilityError extends CoreError {
  constructor(message: string, options?: { cause?: unknown }) {
    super("CAPABILITY_UNSUPPORTED", message, options);
  }
}

export class CoreNotReadyError extends CoreError {
  constructor(message: string, options?: { cause?: unknown }) {
    super("CORE_NOT_READY", message, options);
  }
}

export function isCoreError(error: unknown): error is CoreError {
  return error instanceof CoreError;
}
