import { Box, Text } from "ink";
import type { ModelInfo } from "@dicode/core";
import { COLORS } from "../theme/colors.js";

export function ModelPicker({
  models,
  selectedIndex,
  currentModel,
}: {
  models: ModelInfo[];
  selectedIndex: number;
  currentModel: string | null;
}) {
  return (
    <Box borderStyle="double" borderColor={COLORS.primaryBlue} flexDirection="column" paddingX={1}>
      <Text bold color={COLORS.primaryBlue}>SELECT MODEL</Text>
      {models.length === 0 && <Text color={COLORS.dim}>Loading models…</Text>}
      {models.map((model, index) => {
        const isCurrent = model.model === currentModel || model.id === currentModel;
        return (
          <Text
            key={model.id}
            color={index === selectedIndex ? COLORS.text : COLORS.secondaryText}
          >
            {index === selectedIndex ? "> " : "  "}
            {model.displayName ?? model.model}
            {isCurrent ? " (current)" : ""}
          </Text>
        );
      })}
      <Text color={COLORS.dim}>↑↓ select  Enter choose  Esc close</Text>
    </Box>
  );
}
