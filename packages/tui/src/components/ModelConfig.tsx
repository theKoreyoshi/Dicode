import { Box, Text } from "ink";
import { COLORS } from "../theme/colors.js";
import { cleanInput, composerLines } from "../utils/composer.js";

export const modelConfigFields = [
  { id: "model", label: "Model ID", placeholder: "e.g. my-model", limit: 256 },
  { id: "baseUrl", label: "Base URL", placeholder: "https://gateway.example/v1", limit: 2048 },
  { id: "apiKeyEnv", label: "Key variable", placeholder: "e.g. MODEL_API_KEY (optional)", limit: 128 },
] as const;

export type ModelConfigValues = Record<(typeof modelConfigFields)[number]["id"], string>;

export function ModelConfig({ values, focus, cursor, rows, columns, enabled, error }: {
  values: ModelConfigValues;
  focus: number;
  cursor: number;
  rows: number;
  columns: number;
  enabled: boolean;
  error: string | null;
}) {
  const fieldWidth = Math.max(1, columns - 18);
  const items = modelConfigFields.map(({ id, label, placeholder }, index) => {
    const focused = index === focus;
    const line = focused ? composerLines(values[id], cursor, fieldWidth, 1)[0] : undefined;
    return <Text key={id} wrap="truncate-end" color={focused ? COLORS.text : COLORS.secondaryText}>
      {focused ? "› " : "  "}{label.padEnd(14)}
      {line ? <>{line.before}<Text inverse>{line.cursor}</Text>{line.after}
        {!values[id] && <Text color={COLORS.dim}>{placeholder}</Text>}</>
        : values[id] || <Text color={COLORS.dim}>{placeholder}</Text>}
    </Text>;
  });
  const actions = enabled ? ["Save and use", "Use Codex defaults"] : ["Save and use"];
  actions.forEach((label, index) => {
    const selected = focus === modelConfigFields.length + index;
    items.push(<Text key={label} wrap="truncate-end" color={selected ? COLORS.accentBlue : COLORS.secondaryText}>
      {selected ? "› " : "  "}{label}
    </Text>);
  });
  const visibleRows = Math.max(1, rows - 3);
  const start = Math.max(0, Math.min(focus, items.length - visibleRows));
  const hint = "Responses API · key variable name only · new sessions";
  return (
    <Box paddingX={1} flexDirection="column">
      <Text wrap="truncate-end" bold color={COLORS.accentBlue}>Model configuration</Text>
      {items.slice(start, start + visibleRows)}
      <Text wrap="truncate-end" color={error ? COLORS.error : COLORS.dim}>
        {error ? cleanInput(error).split("\n", 1)[0] : hint}
      </Text>
      <Text wrap="truncate-end" color={COLORS.dim}>Tab / ↑↓ move · Enter select · Esc close</Text>
    </Box>
  );
}
