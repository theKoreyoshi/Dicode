import type { ReactNode } from "react";
import { Box, Text } from "ink";
import { COLORS } from "../theme/colors.js";
import { DICODE_LOGO, DICODE_TAGLINE } from "../theme/logo.js";

interface WelcomeProps {
  projectPath: string | null;
  columns?: number;
  rows?: number;
  children?: ReactNode;
}

export function Welcome({ projectPath, columns = 80, rows = 20, children }: WelcomeProps) {
  const compact = columns < 48 || rows < 15;
  const padding = columns < 44 ? 1 : 2;
  return (
    <Box flexDirection="column" alignItems="center" justifyContent="center" minHeight={rows} paddingX={padding}>
      {rows > 5 && (
        <Box flexDirection="column" alignItems="center" marginBottom={compact ? 0 : 1} flexShrink={0}>
          <Text bold color={COLORS.primaryBlue}>{compact ? "Dicode" : DICODE_LOGO}</Text>
          {!compact && <Text color={COLORS.secondaryText}>{DICODE_TAGLINE}</Text>}
        </Box>
      )}
      <Box width={Math.max(1, Math.min(75, columns - padding * 2))} flexDirection="column">
        {children}
        {rows > 8 && (
          <Box justifyContent="space-between" paddingX={1} gap={2}>
            <Box minWidth={0} flexGrow={1} overflow="hidden">
              <Text color={COLORS.secondaryText} wrap="truncate-start">{projectPath ?? "Current directory"}</Text>
            </Box>
            {columns >= 57 && <Text color={COLORS.secondaryText}>Ctrl+X L Sessions</Text>}
          </Box>
        )}
      </Box>
    </Box>
  );
}
