import { useEffect, useMemo } from "react";
import { Box, Text } from "ink";
import type { UiMessage, UiTool } from "../state/ui-store.js";
import { COLORS } from "../theme/colors.js";
import { MessageLine, messageLines, toolLines, wrapTranscriptLine } from "./Message.js";

interface MessageListProps {
  messages: UiMessage[];
  tools: UiTool[];
  columns: number;
  rows: number;
  scrollOffset: number;
  showToolDetails: boolean;
  onScrollLimitChange?: (limit: number) => void;
}

export function MessageList({
  messages,
  tools,
  columns,
  rows,
  scrollOffset,
  showToolDetails,
  onScrollLimitChange,
}: MessageListProps) {
  const lines = useMemo(() => {
    const entries = [
      ...messages.map((message) => ({ timestamp: message.timestamp ?? 0, lines: messageLines(message) })),
      ...tools.map((tool) => ({ timestamp: tool.timestamp, lines: toolLines(tool, showToolDetails) })),
    ].sort((a, b) => a.timestamp - b.timestamp);
    const logicalLines = entries.flatMap((entry) => entry.lines);
    while (logicalLines.at(-1)?.text === "") logicalLines.pop();
    return logicalLines.flatMap((line) => wrapTranscriptLine(line, columns));
  }, [columns, messages, showToolDetails, tools]);

  const showScrollHint = rows > 1 && lines.length > rows;
  const visibleRows = Math.max(1, rows - Number(showScrollHint));
  const limit = Math.max(0, lines.length - visibleRows);
  const end = lines.length - Math.min(scrollOffset, limit);
  const start = Math.max(0, end - visibleRows);
  useEffect(() => onScrollLimitChange?.(limit), [limit, onScrollLimitChange]);

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
        <Text color={COLORS.secondaryText} wrap="truncate-end">Send a message to begin this session.</Text>
      )}
    </Box>
  );
}
