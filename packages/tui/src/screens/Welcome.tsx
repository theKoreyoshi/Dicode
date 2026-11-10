import type { ReactNode } from "react";
import { Box, Text } from "ink";
import { COMPOSER_MAX_WIDTH } from "../components/Input.js";
import { COLORS } from "../theme/colors.js";
import { DICODE_LOGO, DICODE_TAGLINE } from "../theme/logo.js";

interface WelcomeProps {
  columns?: number;
  rows?: number;
  composerHeight?: number;
  children?: ReactNode;
}

export function Welcome({ columns = 80, rows = 20, composerHeight = 4, children }: WelcomeProps) {
  const spaceForBrand = rows - composerHeight;
  const fullBrand = columns >= 48 && spaceForBrand >= 10;
  const padding = columns < 44 ? 1 : 2;
  return (
    <Box flexDirection="column" alignItems="center" justifyContent="center" minHeight={rows} paddingX={padding}>
      {spaceForBrand >= 2 && (
        <Box flexDirection="column" alignItems="center" marginBottom={1} flexShrink={0}>
          <Text bold color={COLORS.primaryBlue}>{fullBrand ? DICODE_LOGO : "Dicode"}</Text>
          {fullBrand && <Text color={COLORS.secondaryText}>{DICODE_TAGLINE}</Text>}
        </Box>
      )}
      <Box width={Math.max(1, Math.min(COMPOSER_MAX_WIDTH, columns - padding * 2))} flexDirection="column" flexShrink={0}>
        {children}
      </Box>
    </Box>
  );
}
