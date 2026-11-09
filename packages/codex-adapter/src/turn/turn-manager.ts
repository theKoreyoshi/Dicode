import { TurnError } from "../errors/adapter-errors.js";
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
  noteTurnEnded(threadId: string): void;
}

export class CodexTurnManager implements TurnManager {
  private readonly activeTurns = new Map<string, string>();

  constructor(private readonly request: RequestFn) {}

  async start(threadId: string, input: TurnInput): Promise<TurnInfo> {
    const params: StartTurnParams = {
      threadId,
      input: [{ type: "text", text: input.text }],
    };
    const result = (await this.request(ClientMethods.turnStart, params)) as TurnResult;
    const turn = toTurnInfo(result.turn);
    this.activeTurns.set(threadId, turn.id);
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
    await this.request(ClientMethods.turnInterrupt, params);
  }

  getActiveTurnId(threadId: string): string | undefined {
    return this.activeTurns.get(threadId);
  }

  noteTurnStarted(threadId: string, turnId: string): void {
    this.activeTurns.set(threadId, turnId);
  }

  noteTurnEnded(threadId: string): void {
    this.activeTurns.delete(threadId);
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
