import { Box, Text } from "ink";
import { COLORS } from "../theme/colors.js";
import type { UiStatus } from "../state/ui-store.js";

interface StatusBarProps {
  status: UiStatus;
  running: boolean;
  columns?: number;
  projectPath?: string | null;
  notice?: string | null;
  leaderActive?: boolean;
}

export function StatusBar({ status, running, columns = 80, projectPath, notice, leaderActive }: StatusBarProps) {
  const leaderHints = columns >= 58 ? "N New   L Sessions   M Models   B Sidebar" : "N New   L Sessions";
  const hints = leaderActive ? leaderHints : columns >= 49 ? "Ctrl+P Commands" : "Ctrl+P";
  const label = status === "waiting_approval" ? "Approval needed" : running ? "Esc Interrupt" : projectPath;
  const color = status === "waiting_approval" ? COLORS.warning : running ? COLORS.accentBlue : COLORS.secondaryText;
  return (
    <Box height={1} flexShrink={0} paddingX={columns < 40 ? 1 : 2} gap={2} overflow="hidden">
      <Box minWidth={0} flexGrow={1} flexBasis={0} overflow="hidden">
        <Text color={notice ? COLORS.warning : color} wrap={notice ? "truncate-end" : "truncate-start"}>
          {notice?.split(/\r?\n/, 1)[0] ?? label ?? ""}
        </Text>
      </Box>
      <Box width={Math.max(1, Math.min(hints.length, columns - 4))} flexShrink={0} overflow="hidden">
        <Text color={leaderActive ? COLORS.accentBlue : COLORS.secondaryText} wrap="truncate-end">{hints}</Text>
      </Box>
    </Box>
  );
}
