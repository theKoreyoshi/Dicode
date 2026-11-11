import { setTimeout as delay } from "node:timers/promises";
import { RpcResponseError, TurnError } from "../errors/adapter-errors.js";
import { ClientMethods } from "../protocol.js";
import type {
  InterruptTurnParams,
  StartTurnParams,
  SteerTurnParams,
  TurnResult,
} from "../protocol/protocol-types.js";
import type { RequestFn } from "../thread/thread-manager.js";
import type { TurnInfo, TurnInput } from "./turn-types.js";

export interface TurnManager {
  start(threadId: string, input: TurnInput): Promise<TurnInfo>;
  steer(threadId: string, input: TurnInput): Promise<void>;
  interrupt(threadId: string): Promise<void>;
  getActiveTurnId(threadId: string): string | undefined;
  noteTurnStarted(threadId: string, turnId: string): void;
  noteTurnEnded(threadId: string, turnId?: string): void;
  reset(): void;
}

export class CodexTurnManager implements TurnManager {
  private readonly activeTurns = new Map<string, string>();
  private readonly lastEndedTurns = new Map<string, string>();

  constructor(private readonly request: RequestFn) {}

  async start(threadId: string, input: TurnInput): Promise<TurnInfo> {
    const params: StartTurnParams = {
      threadId,
      input: [{ type: "text", text: input.text }],
    };
    if (input.model) params.model = input.model;
    if (input.effort) params.effort = input.effort;
    if (input.permissionMode === "full") {
      params.approvalPolicy = "never";
      params.sandboxPolicy = { type: "dangerFullAccess" };
    }
    if (input.mode && input.model) {
      params.collaborationMode = {
        mode: input.mode,
        settings: {
          model: input.model,
          reasoning_effort: input.effort ?? null,
          developer_instructions: null,
        },
      };
    }
    const result = (await this.request(ClientMethods.turnStart, params)) as TurnResult;
    const turn = toTurnInfo(result.turn);
    if (turn.status === "inProgress" && this.lastEndedTurns.get(threadId) !== turn.id && !this.activeTurns.has(threadId)) {
      this.activeTurns.set(threadId, turn.id);
    }
    return turn;
  }

  async steer(threadId: string, input: TurnInput): Promise<void> {
    const expectedTurnId = this.requireActiveTurn(threadId, "steer");
    const params: SteerTurnParams = {
      threadId,
      expectedTurnId,
      input: [{ type: "text", text: input.text }],
    };
    await this.request(ClientMethods.turnSteer, params);
  }

  async interrupt(threadId: string): Promise<void> {
    const turnId = this.requireActiveTurn(threadId, "interrupt");
    const params: InterruptTurnParams = { threadId, turnId };
    // The start RPC can return before the runtime has attached its active turn.
    const retryDelays = [50, 100, 200, 400, 600, 1000, 1500];
    for (let attempt = 0; this.activeTurns.get(threadId) === turnId; attempt++) {
      try {
        await this.request(ClientMethods.turnInterrupt, params);
        return;
      } catch (error) {
        if (!(error instanceof RpcResponseError) || error.message !== "no active turn to interrupt") throw error;
        if (this.activeTurns.get(threadId) !== turnId) return;
        const retryDelay = retryDelays[attempt];
        if (retryDelay === undefined) throw error;
        await delay(retryDelay);
      }
    }
  }

  getActiveTurnId(threadId: string): string | undefined {
    return this.activeTurns.get(threadId);
  }

  noteTurnStarted(threadId: string, turnId: string): void {
    this.activeTurns.set(threadId, turnId);
  }

  noteTurnEnded(threadId: string, turnId = this.activeTurns.get(threadId)): void {
    if (turnId) this.lastEndedTurns.set(threadId, turnId);
    if (this.activeTurns.get(threadId) === turnId) this.activeTurns.delete(threadId);
  }

  reset(): void {
    this.activeTurns.clear();
    this.lastEndedTurns.clear();
  }

  private requireActiveTurn(threadId: string, action: string): string {
    const turnId = this.activeTurns.get(threadId);
    if (!turnId) {
      throw new TurnError(`cannot ${action}: no active turn for thread ${threadId}`);
    }
    return turnId;
  }
}

function toTurnInfo(turn: TurnResult["turn"]): TurnInfo {
  return {
    id: turn.id,
    status: turn.status,
    startedAt: turn.startedAt,
    completedAt: turn.completedAt,
    error: turn.error?.message ?? null,
    rootTurnId: turn.rootTurnId,
  };
}
