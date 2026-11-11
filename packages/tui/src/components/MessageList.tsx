import { useLayoutEffect, useMemo, useRef } from "react";
import { Box, Text } from "ink";
import type { UiMessage, UiPlan, UiThought, UiTool } from "../state/ui-store.js";
import { COLORS } from "../theme/colors.js";
import { MessageLine, messageLines, planLines, toolCategories, toolLines, wrapTranscriptLine, type TranscriptLine } from "./Message.js";

interface MessageListProps {
  messages: UiMessage[];
  tools: UiTool[];
  thoughts?: UiThought[];
  plan: UiPlan | null;
  columns: number;
  rows: number;
  scrollOffset: number;
  showToolDetails: boolean;
  working?: boolean;
  onScrollLimitChange?: (limit: number, rowDelta: number) => void;
}

export function MessageList({
  messages,
  tools,
  thoughts = [],
  plan,
  columns,
  rows,
  scrollOffset,
  showToolDetails,
  working = false,
  onScrollLimitChange,
}: MessageListProps) {
  const lines = useMemo(() => {
    const entries = [
      ...messages.map((message) => ({ timestamp: message.timestamp ?? 0, kind: "message" as const, message })),
      ...tools.map((tool) => ({ timestamp: tool.timestamp, kind: "tool" as const, tool })),
      ...thoughts.map((thought) => ({ timestamp: thought.timestamp, kind: "thought" as const, thought })),
      ...(plan ? [{ timestamp: plan.timestamp, kind: "plan" as const, plan }] : []),
    ].sort((a, b) => a.timestamp - b.timestamp);
    const logicalLines: TranscriptLine[] = [];
    for (let index = 0; index < entries.length; index++) {
      const entry = entries[index]!;
      if (entry.kind === "message") {
        logicalLines.push(...messageLines(entry.message));
      } else if (entry.kind === "thought") {
        logicalLines.push({ text: `+ Thought: ${formatDuration(entry.thought.durationMs)}`, color: COLORS.warning });
      } else if (entry.kind === "plan") {
        logicalLines.push(...planLines(entry.plan));
      } else {
        const group = [entry.tool];
        const turnId = entry.tool.turnId;
        while (turnId) {
          const next = entries[index + 1];
          if (!next || next.kind !== "tool" || next.tool.turnId !== turnId) break;
          index++;
          group.push(next.tool);
        }
        logicalLines.push(...(!showToolDetails ? activityLines(group) : group.flatMap((tool) => toolLines(tool, showToolDetails))));
      }
    }
    while (logicalLines.at(-1)?.text === "") logicalLines.pop();
    return logicalLines.flatMap((line) => wrapTranscriptLine(line, columns));
  }, [columns, messages, plan, showToolDetails, thoughts, tools]);

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
          {working ? "◌ Working…" : "Send a message to begin this session."}
        </Text>
      )}
    </Box>
  );
}

function activityLines(tools: UiTool[]): TranscriptLine[] {
  const active = tools.find((tool) => tool.status === "running");
  if (active) {
    const label = active.type === "commandExecution" ? "Running command…"
      : active.type === "fileChange" ? "Editing files…"
        : active.type === "webSearch" ? "Searching…" : "Running tool…";
    return [{ text: label, color: COLORS.dim, indent: "   " }];
  }
  const counts = new Map<string, number>();
  for (const tool of tools) {
    const category = tool.status === "failed" ? `failed ${toolCategories[tool.type] ?? "tool"}` : toolCategories[tool.type] ?? "tool";
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }
  const label = [...counts].map(([category, count]) => `${count} ${category}${count === 1 ? "" : category.endsWith("s") ? "" : "s"}`).join(", ");
  return [{ text: label, color: tools.some((tool) => tool.status === "failed") ? COLORS.error : COLORS.dim, indent: "   " }];
}

function formatDuration(milliseconds: number): string {
  return milliseconds < 1_000 ? `${(milliseconds / 1_000).toFixed(1)}s` : `${(milliseconds / 1_000).toFixed(1)}s`;
}
