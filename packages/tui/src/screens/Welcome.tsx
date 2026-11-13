import type { ReactNode } from "react";
import { Box, Text } from "ink";
import { COMPOSER_MAX_WIDTH } from "../components/Input.js";
import { COLORS } from "../theme/colors.js";
import { DICODE_LOGO } from "../theme/logo.js";

interface WelcomeProps {
  columns?: number;
  rows?: number;
  composerHeight?: number;
  children?: ReactNode;
  projectPath?: string | null;
}

export function welcomeBrandRows(columns: number, rows: number, composerHeight: number): number {
  return rows - composerHeight >= 9 && columns >= 58 ? DICODE_LOGO.split("\n").length + 1 : 0;
}

export function Welcome({ columns = 80, rows = 20, composerHeight = 4, children }: WelcomeProps) {
  const padding = columns < 44 ? 1 : 2;
  return (
    <Box flexDirection="column" alignItems="center" justifyContent="center" minHeight={rows} paddingX={padding}>
      {welcomeBrandRows(columns, rows, composerHeight) > 0 && (
        <Box flexDirection="column" alignItems="center" marginBottom={1} flexShrink={0}>
          <Text bold color={COLORS.secondaryText}>{DICODE_LOGO}</Text>
        </Box>
      )}
      <Box width={Math.max(1, Math.min(COMPOSER_MAX_WIDTH, columns - padding * 2))} flexDirection="column" flexShrink={0}>
        {children}
      </Box>
    </Box>
  );
}
