import type { MessagePhase, MessageRecord } from "../storage/storage-types.js";

export function readMessagePhase(value: unknown): MessagePhase | undefined {
  return value === "commentary" || value === "partial_answer" || value === "final_answer" ? value : undefined;
}

export function readMessagePresentation(item: { type?: unknown; phase?: unknown }): Pick<MessageRecord, "phase" | "kind"> {
  if (item.type === "plan") return { kind: "plan" };
  const phase = readMessagePhase(item.phase);
  return phase ? { phase } : {};
}
