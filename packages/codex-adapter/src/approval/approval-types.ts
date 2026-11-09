export type ApprovalType =
  | "command"
  | "fileChange"
  | "permissions"
  | "toolInput"
  | "elicitation"
  | "other";

export interface ApprovalRequest {
  /** JSON-RPC request id (the id the server used, preserved verbatim). */
  id: string | number;
  method: string;
  type: ApprovalType;
  threadId?: string;
  turnId?: string;
  itemId?: string;
  /** Original approval context, preserved for display and future use. */
  params: unknown;
  createdAt: number;
  pending: boolean;
}

export type ApprovalDecision =
  | { kind: "approve" }
  | { kind: "deny" }
  | { kind: "custom"; result: unknown };

export type ApprovalListener = (request: ApprovalRequest) => void;
