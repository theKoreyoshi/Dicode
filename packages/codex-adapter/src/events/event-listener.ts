import type { DicodeEvent, DicodeEventType } from "@dicode/shared";

export type DicodeEventListener = (event: DicodeEvent) => void;

export interface EmitFields {
  sessionId?: string;
  turnId?: string;
  itemId?: string;
  payload?: unknown;
}

/**
 * Small synchronous event bus. It assigns the monotonic event `id` and
 * `timestamp` so callers only need to supply the semantic fields.
 */
export class EventBus {
  private readonly listeners = new Set<DicodeEventListener>();
  private counter = 0;

  emit(type: DicodeEventType, fields: EmitFields = {}): void {
    const event: DicodeEvent = {
      id: `evt-${++this.counter}`,
      type,
      timestamp: Date.now(),
      sessionId: fields.sessionId,
      turnId: fields.turnId,
      itemId: fields.itemId,
      payload: fields.payload,
    };
    for (const listener of [...this.listeners]) {
      try {
        listener(event);
      } catch {
        // A failing subscriber must not break the adapter.
      }
    }
  }

  subscribe(listener: DicodeEventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  clear(): void {
    this.listeners.clear();
  }

  get listenerCount(): number {
    return this.listeners.size;
  }
}
