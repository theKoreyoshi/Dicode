import { Box, Text } from "ink";
import { COLORS } from "../theme/colors.js";
import type { UiStatus } from "../state/ui-store.js";
import { cleanInput } from "../utils/composer.js";

interface StatusBarProps {
  status: UiStatus;
  running: boolean;
  columns?: number;
  notice?: string | null;
  leaderActive?: boolean;
  inputVisible?: boolean;
}

export function StatusBar({ status, running, columns = 80, notice, leaderActive, inputVisible = true }: StatusBarProps) {
  const leaderHints = columns >= 58 ? "N New   L Sessions   M Models   B Sidebar" : "N New   L Sessions";
  const hints = leaderActive ? leaderHints
    : !inputVisible ? columns >= 24 ? "Ctrl+Q Quit" : ""
    : columns >= 86 ? "Ctrl+X S Settings · Ctrl+P Commands · Ctrl+Q Quit"
    : columns >= 64 ? "Ctrl+P Commands · Ctrl+Q Quit"
    : columns >= 49 ? "Ctrl+P Commands" : "Ctrl+P";
  const label = leaderActive ? "Ctrl+X"
    : status === "waiting_approval" ? "Choose an approval response"
    : !inputVisible ? "Esc Back"
    : running ? "Esc Interrupt"
    : columns >= 58 ? "Enter Send  ·  Ctrl+J Newline" : "Enter Send";
  const color = status === "waiting_approval" ? COLORS.warning : running ? COLORS.accentBlue : COLORS.secondaryText;
  return (
    <Box height={1} flexShrink={0} paddingX={columns < 44 ? 1 : 2} gap={2} overflow="hidden">
      <Box minWidth={0} flexGrow={1} flexBasis={0} overflow="hidden">
        <Text color={notice ? COLORS.warning : color} wrap="truncate-end">
          {notice ? cleanInput(notice).split("\n", 1)[0] : label}
        </Text>
      </Box>
      {hints && (
        <Box width={Math.max(1, Math.min(hints.length, columns - 4))} flexShrink={0} overflow="hidden">
          <Text color={leaderActive ? COLORS.accentBlue : COLORS.secondaryText} wrap="truncate-end">{hints}</Text>
        </Box>
      )}
    </Box>
  );
}
