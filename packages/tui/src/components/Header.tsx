import { Box, Text } from "ink";
import { COLORS } from "../theme/colors.js";
import { SYMBOLS } from "../theme/symbols.js";
import type { UiStatus } from "../state/ui-store.js";

export interface HeaderProps {
  status: UiStatus;
  projectName: string | null;
  sessionId: string | null;
  model: string | null;
}

export function Header({ status, projectName, sessionId, model }: HeaderProps) {
  const statusColor = statusColorFor(status);
  const statusLabel = statusLabelFor(status);
  return (
    <Box borderStyle="single" borderColor={COLORS.border} paddingX={1}>
      <Text bold color={COLORS.primaryBlue}>DICODE</Text>
      <Text color={COLORS.secondaryText}>  </Text>
      <Text color={statusColor}>{SYMBOLS[status === "waiting_approval" ? "waiting" : "ready"]} {statusLabel}</Text>
      <Text color={COLORS.secondaryText}>  Project: </Text>
      <Text color={COLORS.text}>{projectName ?? "—"}</Text>
      <Text color={COLORS.secondaryText}>  Session: </Text>
      <Text color={COLORS.text}>{sessionId ? sessionId.slice(0, 12) : "—"}</Text>
      <Text color={COLORS.secondaryText}>  Model: </Text>
      <Text color={COLORS.text}>{model ?? "default"}</Text>
    </Box>
  );
}

function statusColorFor(status: UiStatus): string {
  switch (status) {
    case "running":
      return COLORS.accentBlue;
    case "waiting_approval":
      return COLORS.warning;
    case "error":
      return COLORS.error;
    default:
      return COLORS.success;
  }
}

function statusLabelFor(status: UiStatus): string {
  switch (status) {
    case "initializing":
      return "Initializing";
    case "running":
      return "Running";
    case "waiting_approval":
      return "Waiting Approval";
    case "error":
      return "Error";
    default:
      return "Ready";
  }
}
