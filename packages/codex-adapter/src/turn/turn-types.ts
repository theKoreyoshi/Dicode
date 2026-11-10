import type { TurnStatus } from "../protocol/protocol-types.js";

export interface TurnInput {
  /** Plain-text user input. */
  text: string;
  model?: string;
  effort?: string;
  mode?: "default" | "plan";
}

export interface TurnInfo {
  id: string;
  status: TurnStatus;
  startedAt?: number | null;
  completedAt?: number | null;
  error?: string | null;
  rootTurnId?: string | null;
}
