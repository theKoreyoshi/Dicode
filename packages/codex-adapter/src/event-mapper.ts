/**
 * Maps raw Codex App Server notifications/requests into Dicode internal events.
 *
 * Phase 2 implements the actual translation table. The UI consumes only
 * `DicodeEvent` values, never raw protocol payloads.
 */
import type { DicodeEvent } from "@dicode/shared";

export interface EventMapper {
  map(method: string, params: unknown): DicodeEvent | null;
}
