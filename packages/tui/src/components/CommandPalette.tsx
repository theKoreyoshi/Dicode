import { Box, Text } from "ink";
import { COLORS } from "../theme/colors.js";
import { cleanInput } from "../utils/composer.js";

export interface PickerItem {
  id: string;
  label: string;
  detail?: string;
  hint?: string;
}

export function Picker({ title, query, items, selectedIndex, rows, empty, inline = false }: {
  title: string;
  query?: string;
  items: PickerItem[];
  selectedIndex: number;
  rows: number;
  empty: string;
  inline?: boolean;
}) {
  const start = Math.max(0, Math.min(selectedIndex - Math.floor(rows / 2), items.length - rows));
  return (
    <Box flexDirection="column" flexShrink={0} paddingX={1}
      borderStyle={inline ? undefined : "single"} borderColor={COLORS.border}>
      <Text wrap="truncate-end" bold color={COLORS.accentBlue}>{title}</Text>
      {query !== undefined && <Text wrap="truncate-end" color={COLORS.secondaryText}>{query ? `Search  ${query}▏` : "Type to search…"}</Text>}
      {items.length === 0 && <Text wrap="truncate-end" color={COLORS.dim}>{empty}</Text>}
      {items.slice(start, start + rows).map((item, index) => {
        const selected = start + index === selectedIndex;
        return (
          <Box key={item.id} paddingX={1} justifyContent="space-between">
            <Box flexShrink={1} minWidth={0}>
              <Text wrap="truncate-end" color={selected ? COLORS.text : COLORS.secondaryText}
                backgroundColor={selected ? COLORS.secondaryBackground : undefined}>
                {selected ? "›  " : "   "}{singleLine(item.label)}
                {item.detail && <Text color={COLORS.dim}>{`  ${singleLine(item.detail)}`}</Text>}
              </Text>
            </Box>
            {item.hint && <Box flexShrink={0} marginLeft={1}><Text color={COLORS.dim}>{item.hint}</Text></Box>}
          </Box>
        );
      })}
      {!inline && <Text wrap="truncate-end" color={COLORS.dim}>↑↓ navigate · Enter select · Esc close</Text>}
    </Box>
  );
}

function singleLine(text: string) {
  return cleanInput(text).replace(/\s+/gu, " ");
}
