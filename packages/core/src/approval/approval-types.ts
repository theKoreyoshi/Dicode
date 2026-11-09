import type { ApprovalRecord, ApprovalStatus } from "../storage/storage-types.js";

export type { ApprovalStatus };

export type ApprovalInfo = ApprovalRecord;

export type ApprovalDecision =
  | { kind: "approve" }
  | { kind: "deny" }
  | { kind: "custom"; result: unknown };
