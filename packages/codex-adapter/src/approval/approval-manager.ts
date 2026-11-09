import { ApprovalError } from "../errors/adapter-errors.js";
import { ServerRequestMethods } from "../protocol.js";
import type { ApprovalDecision, ApprovalListener, ApprovalRequest, ApprovalType } from "./approval-types.js";

export type ApprovalRespondFn = (id: string | number, result: unknown) => void;

export interface ApprovalManager {
  getPendingApprovals(): ApprovalRequest[];
  respond(requestId: string, decision: ApprovalDecision): Promise<void>;
  reject(requestId: string): Promise<void>;
  onApproval(listener: ApprovalListener): () => void;
  clear(): void;
}

/**
 * Tracks server-initiated approval requests and maps a local approve/deny
 * decision back to the protocol-specific response shape.
 *
 * It never auto-approves and refuses duplicate responses to the same request.
 */
export class CodexApprovalManager implements ApprovalManager {
  private readonly pending = new Map<string, ApprovalRequest>();
  private readonly listeners = new Set<ApprovalListener>();

  constructor(private readonly respondFn: ApprovalRespondFn) {}

  handleServerRequest(id: string | number, method: string, params: unknown): boolean {
    const type = approvalTypeFor(method);
    if (!type) return false;

    const p = (params ?? {}) as Record<string, unknown>;
    const request: ApprovalRequest = {
      id,
      method,
      type,
      threadId: stringOrUndefined(p.threadId),
      turnId: stringOrUndefined(p.turnId),
      itemId: stringOrUndefined(p.itemId),
      params,
      createdAt: Date.now(),
      pending: true,
    };
    this.pending.set(String(id), request);
    for (const listener of [...this.listeners]) {
      try {
        listener(request);
      } catch {
        // ignore listener failures
      }
    }
    return true;
  }

  getPendingApprovals(): ApprovalRequest[] {
    return [...this.pending.values()];
  }

  async respond(requestId: string, decision: ApprovalDecision): Promise<void> {
    const request = this.requirePending(requestId);
    let result: unknown;

    switch (decision.kind) {
      case "approve":
        result = approvalResult(request.type);
        break;
      case "deny":
        result = denialResult(request.type);
        break;
      case "custom":
        result = decision.result;
        break;
    }

    this.pending.delete(String(request.id));
    this.respondFn(request.id, result);
  }

  async reject(requestId: string): Promise<void> {
    await this.respond(requestId, { kind: "deny" });
  }

  onApproval(listener: ApprovalListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  clear(): void {
    this.pending.clear();
  }

  private requirePending(requestId: string): ApprovalRequest {
    const request = this.pending.get(requestId);
    if (!request) {
      throw new ApprovalError(`approval request not found or already resolved: ${requestId}`);
    }
    return request;
  }
}

function approvalTypeFor(method: string): ApprovalType | null {
  switch (method) {
    case ServerRequestMethods.commandExecutionRequestApproval:
      return "command";
    case ServerRequestMethods.fileChangeRequestApproval:
      return "fileChange";
    case ServerRequestMethods.permissionsRequestApproval:
      return "permissions";
    case ServerRequestMethods.toolRequestUserInput:
      return "toolInput";
    case ServerRequestMethods.mcpServerElicitationRequest:
      return "elicitation";
    default:
      return null;
  }
}

function approvalResult(type: ApprovalType): unknown {
  switch (type) {
    case "command":
    case "fileChange":
      return { decision: "accept" };
    case "permissions":
      return { permissions: {}, scope: "turn" };
    case "toolInput":
      return { answers: {} };
    default:
      return {};
  }
}

function denialResult(type: ApprovalType): unknown {
  switch (type) {
    case "command":
    case "fileChange":
      return { decision: "decline" };
    case "permissions":
      return { permissions: { fileSystem: null, network: null }, scope: "turn" };
    default:
      return {};
  }
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
