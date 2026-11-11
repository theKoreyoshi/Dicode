import type { UiTokenUsage } from "../state/ui-store.js";

const CONTEXT_BASELINE_TOKENS = 12_000;
const compactNumber = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

export function contextUsagePercent(usage: UiTokenUsage): number | null {
  const { contextTokens, modelContextWindow } = usage;
  if (!Number.isFinite(contextTokens) || !modelContextWindow || !Number.isFinite(modelContextWindow)) return null;

  const available = modelContextWindow - CONTEXT_BASELINE_TOKENS;
  const used = Math.max(0, contextTokens - CONTEXT_BASELINE_TOKENS);
  if (available <= 0) return Math.max(0, Math.min(100, Math.round(contextTokens / modelContextWindow * 100)));
  const remainingPercent = Math.round((available - used) / available * 100);
  return Math.max(0, Math.min(100, 100 - remainingPercent));
}

export function formatContextUsage(usage: UiTokenUsage): string {
  const used = compactNumber.format(usage.contextTokens);
  if (!usage.modelContextWindow) return `${used} tokens`;
  const window = compactNumber.format(usage.modelContextWindow);
  const percent = contextUsagePercent(usage);
  return `${used}/${window}${percent === null ? "" : ` (${percent}%)`}`;
}
