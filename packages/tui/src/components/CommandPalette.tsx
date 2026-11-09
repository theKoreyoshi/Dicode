import { Box, Text } from "ink";
import { COLORS } from "../theme/colors.js";

export interface Command {
  id: string;
  label: string;
}

export function CommandPalette({ commands, selectedIndex }: { commands: Command[]; selectedIndex: number }) {
  return (
    <Box borderStyle="double" borderColor={COLORS.primaryBlue} flexDirection="column" paddingX={1}>
      <Text bold color={COLORS.primaryBlue}>COMMAND PALETTE</Text>
      <Text color={COLORS.dim}>Search commands... (Ctrl+P to close)</Text>
      <Text> </Text>
      {commands.map((command, index) => (
        <Text key={command.id} color={index === selectedIndex ? COLORS.text : COLORS.secondaryText}>
          {index === selectedIndex ? "> " : "  "}
          {command.label}
        </Text>
      ))}
    </Box>
  );
}
