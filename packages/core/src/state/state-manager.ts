import type { DicodeState } from "./state-types.js";

export type StateListener = (state: DicodeState) => void;

/**
 * Owns the in-memory application state. Mutation goes through `update`; the UI
 * reads through `getState`/`select` and reacts via `subscribe`. No external
 * code mutates the state object directly.
 */
export class StateManager {
  private state: DicodeState;
  private readonly listeners = new Set<StateListener>();

  constructor(initial: DicodeState) {
    this.state = initial;
  }

  getState(): Readonly<DicodeState> {
    return this.state;
  }

  update(mutator: (draft: DicodeState) => void): void {
    mutator(this.state);
    for (const listener of [...this.listeners]) {
      try {
        listener(this.state);
      } catch {
        // A failing subscriber must not break state updates.
      }
    }
  }

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  select<T>(selector: (state: DicodeState) => T): T {
    return selector(this.state);
  }
}
