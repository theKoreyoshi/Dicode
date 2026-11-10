import { Box, Text } from "ink";
import stringWidth from "string-width";
import { COLORS } from "../theme/colors.js";
import type { UiStatus } from "../state/ui-store.js";

export interface HeaderProps {
  status: UiStatus;
  projectName: string | null;
  sessionId: string | null;
  model: string | null;
  sessionTitle?: string | null;
  columns?: number;
}

export function Header({ status, projectName, sessionId, model, sessionTitle, columns = 80 }: HeaderProps) {
  const statusColor = statusColorFor(status);
  const statusLabel = statusLabelFor(status);
  const title = sessionTitle || projectName || sessionId?.slice(0, 8) || "Dicode";
  return (
    <Box height={1} flexShrink={0} paddingX={columns < 40 ? 1 : 2} gap={2} overflow="hidden">
      <Box minWidth={0} flexGrow={1} flexBasis={0} overflow="hidden">
        <Text wrap="truncate-end">
          {columns >= 55 && <Text color={COLORS.primaryBlue}>◆ </Text>}
          <Text bold color={COLORS.text}>{title}</Text>
          {columns >= 75 && projectName && projectName !== title && (
            <Text color={COLORS.secondaryText}> · {projectName}</Text>
          )}
        </Text>
      </Box>
      {columns >= 55 && model && (
        <Box width={Math.min(stringWidth(model), Math.floor(columns / 3))} flexShrink={0} overflow="hidden">
          <Text color={COLORS.secondaryText} wrap="truncate-end">{model}</Text>
        </Box>
      )}
      {columns >= 24 && (
        <Box flexShrink={0}>
          <Text color={statusColor}>● {statusLabel}</Text>
        </Box>
      )}
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
      return "Approval needed";
    case "error":
      return "Error";
    default:
      return "Ready";
  }
}
