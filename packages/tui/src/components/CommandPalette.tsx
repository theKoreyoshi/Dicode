import { Box, Text } from "ink";
import stringWidth from "string-width";
import { COLORS } from "../theme/colors.js";
import { cleanInput } from "../utils/composer.js";

export interface PickerItem {
  id: string;
  label: string;
  detail?: string;
  description?: string;
  hint?: string;
}

export function Picker({ title, query, items, selectedIndex, rows, empty, inline = false, autocomplete = false, width }: {
  title: string;
  query?: string;
  items: PickerItem[];
  selectedIndex: number;
  rows: number;
  empty: string;
  inline?: boolean;
  autocomplete?: boolean;
  width?: number;
}) {
  const start = Math.max(0, Math.min(selectedIndex - Math.floor(rows / 2), items.length - rows));
  return (
    <Box width={width} flexDirection="column" flexShrink={0} paddingX={autocomplete ? 0 : 1}
      borderStyle={inline ? undefined : "single"} borderColor={COLORS.border}>
      {!autocomplete && <Text wrap="truncate-end" bold color={COLORS.accentBlue}>{title}</Text>}
      {!autocomplete && query !== undefined && <Text wrap="truncate-end" color={COLORS.secondaryText}>{query ? `Search  ${query}▏` : "Type to search…"}</Text>}
      {items.length === 0 && <Text wrap="truncate-end" color={COLORS.dim}
        backgroundColor={autocomplete ? COLORS.primaryBackground : undefined}>
        {empty}{autocomplete && " ".repeat(Math.max(0, (width ?? 60) - stringWidth(empty)))}
      </Text>}
      {items.slice(start, start + rows).map((item, index) => {
        const selected = start + index === selectedIndex;
        const label = singleLine(item.label);
        const detail = singleLine(item.detail ?? "");
        const hintWidth = stringWidth(item.hint ?? "");
        const rowWidth = Math.max(1, (width ?? 60) - (autocomplete ? 0 : 4));
        if (autocomplete) {
          const background = selected ? COLORS.commandSelected : COLORS.primaryBackground;
          const labelWidth = Math.min(22, Math.max(10, Math.floor(rowWidth * 0.28)));
          const shownLabel = truncate(label, labelWidth);
          const shownDetail = truncate(detail, Math.max(0, rowWidth - labelWidth));
          const labelPadding = " ".repeat(Math.max(0, labelWidth - stringWidth(shownLabel)));
          const fill = " ".repeat(Math.max(0, rowWidth - labelWidth - stringWidth(shownDetail)));
          return (
            <Box key={item.id} width="100%" height={1} flexDirection="row" overflow="hidden">
              <Text wrap="truncate-end" color={selected ? COLORS.background : COLORS.text}
                backgroundColor={background}>{shownLabel}{labelPadding}</Text>
              <Text wrap="truncate-end" color={selected ? COLORS.background : COLORS.secondaryText}
                backgroundColor={background}>{shownDetail}{fill}</Text>
            </Box>
          );
        }
        const textWidth = Math.max(1, rowWidth - hintWidth - Number(Boolean(item.hint)) - 1);
        const labelWidth = Math.min(stringWidth(label), Math.max(1, Math.floor(textWidth * 0.35)));
        const shownLabel = truncate(label, labelWidth);
        const shownDetail = truncate(detail, Math.max(0, textWidth - stringWidth(shownLabel) - 2));
        const content = `${selected ? " " : " "}${shownLabel}${shownDetail ? `  ${shownDetail}` : ""}`;
        const fill = " ".repeat(Math.max(0, textWidth - stringWidth(content)));
        return (
          <Box key={item.id} width="100%" paddingX={1} flexDirection="row" overflow="hidden">
            <Text wrap="truncate-end" color={selected ? COLORS.background : COLORS.secondaryText}
              backgroundColor={selected ? COLORS.commandSelected : undefined}>
              {content}{fill}
            </Text>
            {item.hint && <Box flexShrink={0} marginLeft={1}><Text color={COLORS.dim}>{item.hint}</Text></Box>}
          </Box>
        );
      })}
      {!autocomplete && items[selectedIndex]?.description && (
        <Text wrap="truncate-end" color={COLORS.secondaryText}>{singleLine(items[selectedIndex].description!)}</Text>
      )}
      {!inline && <Text wrap="truncate-end" color={COLORS.dim}>↑↓ navigate · Enter select · Esc close</Text>}
    </Box>
  );
}

function singleLine(text: string) {
  return cleanInput(text).replace(/\s+/gu, " ");
}

function truncate(value: string, width: number): string {
  if (stringWidth(value) <= width) return value;
  if (width < 2) return "…";
  let result = "";
  for (const character of value) {
    if (stringWidth(result + character + "…") > width) break;
    result += character;
  }
  return `${result}…`;
}
