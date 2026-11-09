import { Box, Text } from "ink";
import { COLORS } from "../theme/colors.js";

export function Input({ value, running }: { value: string; running: boolean }) {
  return (
    <Box borderStyle="single" borderColor={COLORS.border} paddingX={1}>
      <Text color={COLORS.primaryBlue}>{running ? "■ " : "> "}</Text>
      <Text color={COLORS.text}>{value}</Text>
      <Text color={COLORS.primaryBlue}>▌</Text>
    </Box>
  );
}
