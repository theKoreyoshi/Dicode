import { useLayoutEffect, useMemo, useRef } from "react";
import { Box, Text } from "ink";
import type { UiMessage, UiPlan, UiTool } from "../state/ui-store.js";
import { COLORS } from "../theme/colors.js";
import { MessageLine, messageLines, planLines, toolLines, wrapTranscriptLine } from "./Message.js";

interface MessageListProps {
  messages: UiMessage[];
  tools: UiTool[];
  plan: UiPlan | null;
  columns: number;
  rows: number;
  scrollOffset: number;
  showToolDetails: boolean;
  running: boolean;
  activeTaskId: string | null;
  onScrollLimitChange?: (limit: number, rowDelta: number) => void;
}

export function MessageList({
  messages,
  tools,
  plan,
  columns,
  rows,
  scrollOffset,
  showToolDetails,
  running,
  activeTaskId,
  onScrollLimitChange,
}: MessageListProps) {
  const lines = useMemo(() => {
    const visibleMessages = showToolDetails ? messages : compactMessages(messages, running, activeTaskId);
    const entries = [
      ...visibleMessages.map((message) => ({ timestamp: message.timestamp ?? 0, lines: messageLines(message) })),
      ...tools.map((tool) => ({ timestamp: tool.timestamp, lines: toolLines(tool, showToolDetails) })),
      ...(plan ? [{ timestamp: plan.timestamp, lines: planLines(plan) }] : []),
    ].sort((a, b) => a.timestamp - b.timestamp);
    const logicalLines = entries.flatMap((entry) => entry.lines);
    while (logicalLines.at(-1)?.text === "") logicalLines.pop();
    return logicalLines.flatMap((line) => wrapTranscriptLine(line, columns));
  }, [activeTaskId, columns, messages, plan, running, showToolDetails, tools]);

  const showScrollHint = rows > 1 && lines.length > rows;
  const visibleRows = Math.max(1, rows - Number(showScrollHint));
  const limit = Math.max(0, lines.length - visibleRows);
  const end = lines.length - Math.min(scrollOffset, limit);
  const start = Math.max(0, end - visibleRows);
  const previous = useRef({ count: lines.length, columns, showToolDetails });
  useLayoutEffect(() => {
    // Keep an older page in place while new transcript rows arrive at the end.
    const layout = previous.current;
    const rowDelta = layout.columns === columns && layout.showToolDetails === showToolDetails ? lines.length - layout.count : 0;
    previous.current = { count: lines.length, columns, showToolDetails };
    onScrollLimitChange?.(limit, rowDelta);
  }, [columns, limit, lines.length, onScrollLimitChange, showToolDetails]);

  return (
    <Box width={columns} height={rows} flexDirection="column" flexShrink={0} overflow="hidden">
      {showScrollHint && (
        <Box height={1} flexShrink={0}>
          <Text color={COLORS.secondaryText} wrap="truncate-end">
            {start > 0 ? "PgUp Older" : "Start of conversation"}
            {end < lines.length ? "  ·  PgDn Newer" : ""}
          </Text>
        </Box>
      )}
      {lines.length > 0 ? (
        lines.slice(start, end).map((line, index) => <MessageLine line={line} key={start + index} />)
      ) : (
        <Text color={COLORS.secondaryText} wrap="truncate-end">
          {running ? "◌ Working…" : "Send a message to begin this session."}
        </Text>
      )}
    </Box>
  );
}

function compactMessages(messages: UiMessage[], running: boolean, activeTaskId: string | null): UiMessage[] {
  const visible = new Set<UiMessage>();
  const authoritative = new Set<string>();
  const phaseLessAnswers = new Map<string, UiMessage>();
  let legacyGroup = "history";
  let latestGroup = legacyGroup;
  for (const message of messages) {
    const scope = message.taskId ? `task:${message.taskId}` : message.turnId ? `turn:${message.turnId}` : null;
    if (message.role === "user") {
      legacyGroup = scope ?? `prompt:${message.id}`;
      latestGroup = legacyGroup;
      visible.add(message);
      continue;
    }
    const group = scope ?? legacyGroup;
    latestGroup = group;
    if (message.incomplete) continue;
    if (message.phase === "final_answer" || message.kind === "plan") {
      authoritative.add(group);
      if (message.content.trim()) visible.add(message);
    } else if (!message.phase && !message.streaming && message.content.trim()) {
      phaseLessAnswers.set(group, message);
    }
  }
  for (const [group, message] of phaseLessAnswers) {
    const active = running && (group === `task:${activeTaskId}` || !message.taskId && group === latestGroup);
    if (!active && !authoritative.has(group)) visible.add(message);
  }
  return messages.filter((message) => visible.has(message));
}
