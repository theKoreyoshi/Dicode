import type { ApprovalRequest } from "@dicode/codex-adapter";
import type { AgentApprovalManager } from "../application/agent-adapter.js";
import type { EventManager } from "../event/event-manager.js";
import { ApprovalError } from "../errors/core-errors.js";
import type { ApprovalRepository, TaskRepository } from "../storage/repositories.js";
import type { ApprovalRecord } from "../storage/storage-types.js";
import type { StateManager } from "../state/state-manager.js";
import { createId } from "../utils/id.js";
import { nowMs } from "../utils/time.js";
import type { ApprovalDecision, ApprovalInfo } from "./approval-types.js";

export interface ApprovalContextResolver {
  resolve(threadId: string, turnId: string | undefined): { sessionId?: string; taskId?: string };
}

export class ApprovalManager {
  constructor(
    private readonly adapterApprovals: AgentApprovalManager,
    private readonly approvalRepo: ApprovalRepository,
    private readonly taskRepo: TaskRepository,
    private readonly stateManager: StateManager,
    private readonly eventManager: EventManager,
    private readonly contextResolver: ApprovalContextResolver,
  ) {}

  start(): () => void {
    return this.adapterApprovals.onApproval((request) => this.handleRequest(request));
  }

  handleRequest(request: ApprovalRequest): ApprovalInfo {
    const context = this.contextResolver.resolve(request.threadId ?? "", request.turnId);
    const record: ApprovalRecord = {
      id: createId("approval"),
      sessionId: context.sessionId ?? request.threadId ?? "",
      taskId: context.taskId ?? null,
      codexRequestId: String(request.id),
      type: request.type,
      title: approvalTitle(request),
      description: approvalDescription(request),
      status: "pending",
      metadata: { method: request.method, params: request.params },
      createdAt: nowMs(),
      resolvedAt: null,
    };
    this.approvalRepo.insert(record);

    if (record.taskId) {
      const task = this.taskRepo.get(record.taskId);
      if (task && task.status === "running") {
        task.status = "waiting_approval";
        this.taskRepo.update(task);
      }
    }

    this.stateManager.update((s) => {
      s.approvals.approvals[record.id] = record;
      if (record.taskId && s.tasks.tasks[record.taskId]) {
        s.tasks.tasks[record.taskId].status = "waiting_approval";
      }
      if (record.sessionId && s.sessions.sessions[record.sessionId]) {
        s.sessions.sessions[record.sessionId].status = "waiting_approval";
      }
    });
    this.eventManager.emit("approval.requested", {
      sessionId: record.sessionId,
      taskId: record.taskId ?? undefined,
      payload: record,
    });
    return record;
  }

  async respond(approvalId: string, decision: ApprovalDecision): Promise<void> {
    const record = this.requirePending(approvalId);
    const adapterDecision = decision.kind === "approve" ? { kind: "approve" as const } : decision.kind === "deny" ? { kind: "deny" as const } : { kind: "custom" as const, result: (decision as { result: unknown }).result };
    await this.adapterApprovals.respond(record.codexRequestId, adapterDecision);

    record.status = decision.kind === "approve" ? "approved" : decision.kind === "deny" ? "rejected" : "approved";
    record.resolvedAt = nowMs();
    this.approvalRepo.update(record);

    this.stateManager.update((s) => {
      s.approvals.approvals[record.id] = record;
    });
    this.eventManager.emit("approval.resolved", {
      sessionId: record.sessionId,
      taskId: record.taskId ?? undefined,
      payload: record,
    });
  }

  async reject(approvalId: string): Promise<void> {
    await this.respond(approvalId, { kind: "deny" });
  }

  getPending(): ApprovalInfo[] {
    return this.approvalRepo.listPending();
  }

  listBySession(sessionId: string): ApprovalInfo[] {
    return this.approvalRepo.listBySession(sessionId);
  }

  expirePending(sessionIds: ReadonlySet<string>): void {
    for (const record of this.approvalRepo.listPending()) {
      if (!sessionIds.has(record.sessionId)) continue;
      record.status = "expired";
      record.resolvedAt = nowMs();
      this.approvalRepo.update(record);
      this.stateManager.update((s) => {
        s.approvals.approvals[record.id] = record;
      });
    }
  }

  private requirePending(approvalId: string): ApprovalRecord {
    const record = this.approvalRepo.get(approvalId);
    if (!record) throw new ApprovalError("APPROVAL_NOT_FOUND", `approval not found: ${approvalId}`);
    if (record.status !== "pending") {
      throw new ApprovalError("APPROVAL_ALREADY_RESOLVED", `approval already resolved: ${approvalId}`);
    }
    return record;
  }
}

function approvalTitle(request: ApprovalRequest): string {
  switch (request.type) {
    case "command":
      return "Approve shell command";
    case "fileChange":
      return "Approve file changes";
    case "permissions":
      return "Approve permissions";
    case "toolInput":
      return "Tool input required";
    default:
      return "Approval required";
  }
}

function approvalDescription(request: ApprovalRequest): string | null {
  const params = request.params as Record<string, unknown> | undefined;
  if (request.type === "command" && typeof params?.command === "string") {
    return params.command;
  }
  if (typeof params?.reason === "string") return params.reason;
  return null;
}
