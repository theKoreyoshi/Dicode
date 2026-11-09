import { describe, expect, it, vi } from "vitest";
import { createHarness } from "./helpers.js";

describe("StateManager", () => {
  it("updates state and notifies subscribers", () => {
    const { state } = createHarness();
    const listener = vi.fn();
    state.subscribe(listener);
    state.update((s) => {
      s.runtime.connected = false;
    });
    expect(state.getState().runtime.connected).toBe(false);
    expect(listener).toHaveBeenCalled();
  });

  it("isolates a throwing subscriber", () => {
    const { state } = createHarness();
    const good = vi.fn();
    state.subscribe(() => {
      throw new Error("boom");
    });
    state.subscribe(good);
    expect(() => state.update((s) => void s)).not.toThrow();
    expect(good).toHaveBeenCalled();
  });

  it("supports selectors", () => {
    const { state } = createHarness();
    expect(state.select((s) => s.runtime.status)).toBe("ready");
  });
});
