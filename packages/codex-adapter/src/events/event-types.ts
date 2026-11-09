import type { DicodeEvent, DicodeEventType } from "@dicode/shared";

export type { DicodeEvent, DicodeEventType };

/** A decoded server notification before it is mapped to a Dicode event. */
export interface RawNotification {
  method: string;
  params: unknown;
}

/** A Dicode event with only its discriminator and payload, before id/timestamp. */
export interface MappedEvent {
  type: DicodeEventType;
  sessionId?: string;
  turnId?: string;
  itemId?: string;
  payload: unknown;
}
