import { Box, Text } from "ink";
import { COLORS } from "../theme/colors.js";
import { DICODE_LOGO, DICODE_TAGLINE } from "../theme/logo.js";

export function Welcome({ projectPath }: { projectPath: string | null }) {
  return (
    <Box flexDirection="column" alignItems="center" paddingY={1}>
      <Text color={COLORS.primaryBlue}>{DICODE_LOGO}</Text>
      <Text color={COLORS.accentBlue}>{DICODE_TAGLINE}</Text>
      <Text> </Text>
      <Text color={COLORS.text} bold>Welcome to Dicode</Text>
      <Text color={COLORS.secondaryText}>A powerful AI coding assistant powered by Codex Runtime.</Text>
      <Text> </Text>
      <Text color={COLORS.secondaryText}>Current Project</Text>
      <Text color={projectPath ? COLORS.text : COLORS.dim}>{projectPath ?? "No project selected"}</Text>
      <Text> </Text>
      <Text bold color={COLORS.accentBlue}>Quick Start</Text>
      <Text color={COLORS.text}>  [1] Open Current Directory</Text>
      <Text color={COLORS.text}>  [2] Create New Session</Text>
      <Text color={COLORS.text}>  [3] Resume a Session</Text>
      <Text> </Text>
      <Text color={COLORS.dim}>Ctrl+P  Command Palette   Ctrl+Q  Quit</Text>
    </Box>
  );
}
