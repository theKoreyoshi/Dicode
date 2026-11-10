import type { DicodeEventType } from "@dicode/shared";
import { ServerNotificationMethods } from "../protocol.js";
import type { MappedEvent, RawNotification } from "./event-types.js";

type Record = { [key: string]: unknown };

const TOOL_ITEM_TYPES = new Set([
  "functionCall",
  "mcpToolCall",
  "dynamicToolCall",
  "webSearch",
  "imageGeneration",
  "collabAgentToolCall",
]);

const FILE_ITEM_TYPES = new Set(["fileChange", "patchApply"]);

/**
 * Maps raw App Server notifications into Dicode internal events. Unknown
 * methods become `unknown` events instead of throwing, so a forward protocol
 * change can never crash the adapter.
 */
export function mapNotification(notification: RawNotification): MappedEvent {
  const { method, params } = notification;
  const p = (params ?? {}) as Record;
  const threadId = stringOrUndefined(p.threadId);
  const turnId = stringOrUndefined(p.turnId);
  const itemId = stringOrUndefined(p.itemId);

  const base = { sessionId: threadId, turnId, itemId };

  switch (method) {
    case ServerNotificationMethods.turnStarted:
      return {
        type: "turn.started",
        ...base,
        turnId: stringOrUndefined((p.turn as Record | undefined)?.id) ?? turnId,
        payload: p,
      };
    case ServerNotificationMethods.turnCompleted:
      return {
        type: "turn.completed",
        ...base,
        turnId: stringOrUndefined((p.turn as Record | undefined)?.id) ?? turnId,
        payload: p,
      };
    case ServerNotificationMethods.itemStarted:
      return itemEvent("started", p, base);
    case ServerNotificationMethods.itemCompleted:
      return itemEvent("completed", p, base);
    case ServerNotificationMethods.agentMessageDelta:
    case ServerNotificationMethods.planDelta:
      return { type: "agent.message.delta", ...base, payload: p };
    case ServerNotificationMethods.reasoningTextDelta:
    case ServerNotificationMethods.reasoningSummaryTextDelta:
    case ServerNotificationMethods.reasoningSummaryPartAdded:
      return { type: "reasoning.delta", ...base, payload: p };
    case ServerNotificationMethods.commandExecutionOutputDelta:
    case ServerNotificationMethods.commandExecOutputDelta:
    case ServerNotificationMethods.processOutputDelta:
      return { type: "shell.output", ...base, payload: p };
    case ServerNotificationMethods.fileChangeOutputDelta:
      return { type: "tool.output", ...base, payload: p };
    case ServerNotificationMethods.fileChangePatchUpdated:
      return { type: "file.changed", ...base, payload: p };
    case ServerNotificationMethods.mcpToolCallProgress:
      return { type: "tool.output", ...base, payload: { ...p, delta: typeof p.message === "string" ? `${p.message}\n` : undefined } };
    case ServerNotificationMethods.turnDiffUpdated:
      return { type: "diff.updated", ...base, payload: p };
    case ServerNotificationMethods.turnPlanUpdated:
      return { type: "plan.updated", ...base, payload: p };
    case ServerNotificationMethods.threadTokenUsageUpdated:
      return { type: "token.usage", ...base, payload: p };
    case ServerNotificationMethods.threadStarted:
      return { type: "session.created", ...base, sessionId: stringOrUndefined((p.thread as Record | undefined)?.id) ?? threadId, payload: p };
    case ServerNotificationMethods.threadStatusChanged:
      return { type: "connection.status", ...base, payload: p };
    case ServerNotificationMethods.error:
      return { type: "agent.error", ...base, payload: p };
    default:
      return { type: "unknown", ...base, payload: { method, params: p } };
  }
}

function itemEvent(
  phase: "started" | "completed",
  p: Record,
  base: { sessionId?: string; turnId?: string; itemId?: string },
): MappedEvent {
  const item = (p.item ?? {}) as Record;
  const itemType = stringOrUndefined(item.type);
  const generalType: DicodeEventType = phase === "started" ? "item.started" : "item.completed";

  let specificType: DicodeEventType | null = null;
  if (itemType === "commandExecution") {
    specificType = phase === "started" ? "shell.started" : "shell.completed";
  } else if (itemType && TOOL_ITEM_TYPES.has(itemType)) {
    specificType = phase === "started" ? "tool.started" : "tool.completed";
  } else if (itemType && FILE_ITEM_TYPES.has(itemType)) {
    specificType = phase === "started" ? "tool.started" : "file.changed";
  }

  return {
    type: specificType ?? generalType,
    ...base,
    itemId: base.itemId ?? stringOrUndefined(item.id),
    payload: p,
  };
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
