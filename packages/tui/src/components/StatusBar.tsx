import { Box, Text } from "ink";
import { COLORS } from "../theme/colors.js";
import type { UiStatus } from "../state/ui-store.js";

export function StatusBar({ status, running }: { status: UiStatus; running: boolean }) {
  const label = running ? "Running" : status === "waiting_approval" ? "Waiting Approval" : "Ready";
  const color = running ? COLORS.accentBlue : status === "waiting_approval" ? COLORS.warning : COLORS.success;
  return (
    <Box borderStyle="single" borderColor={COLORS.border} paddingX={1}>
      <Text color={color}>● {label}</Text>
      <Text color={COLORS.secondaryText}>  |  </Text>
      <Text color={COLORS.secondaryText}>Enter Send  Shift+Enter Newline  </Text>
      <Text color={COLORS.secondaryText}>{running ? "Ctrl+C Cancel  " : "Ctrl+N New  "}</Text>
      <Text color={COLORS.secondaryText}>Ctrl+P Commands  Ctrl+Q Quit</Text>
    </Box>
  );
}
