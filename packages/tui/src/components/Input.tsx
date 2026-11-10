import { Box, Text } from "ink";
import stringWidth from "string-width";
import { COLORS } from "../theme/colors.js";
import { cleanInput, composerLines } from "../utils/composer.js";

export const COMPOSER_MAX_WIDTH = 75;

interface InputProps {
  value: string;
  cursor: number;
  width: number;
  maxRows: number;
  focused: boolean;
  running: boolean;
  mode: "default" | "plan";
  model: string | null;
  effort: string | null;
  queued: string | null;
  compact?: boolean;
}

type ComposerMeasureOptions = Pick<InputProps, "value" | "cursor" | "width" | "maxRows" | "queued" | "compact">;

export function measureComposerHeight({ value, cursor, width, maxRows, queued, compact }: ComposerMeasureOptions): number {
  const layout = composerLayout(width, compact);
  return composerLines(value, cursor, layout.editableWidth, maxRows).length + (layout.framed ? 2 : 0) + 1 + Number(Boolean(queued));
}

export function Input({ value, cursor, width, maxRows, focused, running, mode, model, effort, queued, compact }: InputProps) {
  const layout = composerLayout(width, compact);
  const accent = focused ? COLORS.accentBlue : COLORS.border;
  const lines = composerLines(value, cursor, layout.editableWidth, maxRows);
  const prompt = running ? "Send a follow-up…" : "Ask Dicode about your project…";
  return (
    <Box flexDirection="column" width={width} flexShrink={0}>
      <Box flexDirection="column" flexShrink={0} paddingX={layout.padding}
        borderStyle={layout.framed ? "round" : "single"} borderColor={accent}
        borderTop={layout.framed} borderBottom={layout.framed} borderRight={layout.framed} borderLeft={layout.leftRail}>
        {value ? lines.map((line, index) => (
          <Text key={index} wrap="truncate-end" color={COLORS.text} backgroundColor={COLORS.primaryBackground}>
            {layout.marker && <Text color={accent}>{index === 0 ? "› " : "  "}</Text>}
            {line.before}
            {line.cursor !== undefined && <Text inverse={focused}>{line.cursor}</Text>}
            {line.after}
            {" ".repeat(Math.max(0, layout.editableWidth - stringWidth(line.before + (line.cursor ?? "") + line.after)))}
          </Text>
        )) : (
          <Text wrap="truncate-end" color={COLORS.secondaryText} backgroundColor={COLORS.primaryBackground}>
            {layout.marker && <Text color={accent}>› </Text>}
            <Text inverse={focused}> </Text>
            {prompt}
            {" ".repeat(Math.max(0, layout.editableWidth - 1 - stringWidth(prompt)))}
          </Text>
        )}
      </Box>
      {queued && (
        <Box height={1} paddingX={layout.padding} overflow="hidden">
          <Text wrap="truncate-end" color={COLORS.warning}>Queued · {cleanInput(queued).split("\n", 1)[0]}</Text>
        </Box>
      )}
      <ComposerSettings width={width} mode={mode} model={model} effort={effort} />
    </Box>
  );
}

function ComposerSettings({ width, mode, model, effort }: Pick<InputProps, "width" | "mode" | "model" | "effort">) {
  const labeled = width >= 56;
  const modeColor = mode === "plan" ? COLORS.warning : COLORS.accentBlue;
  const showEffort = Boolean(effort && width >= 20);
  const effortText = labeled ? `Effort ${effort}` : effort ?? "";
  return (
    <Box width={width} height={1} flexShrink={0} paddingX={width >= 14 ? 1 : 0} gap={width >= 42 ? 2 : 1} overflow="hidden">
      <Box flexShrink={0}>
        <Setting label={labeled ? "Agent" : undefined} value={mode === "plan" ? "Plan" : "Build"} color={modeColor} />
      </Box>
      {width >= 10 && (
        <Box minWidth={0} flexGrow={1} flexBasis={0} overflow="hidden">
          <Setting label={labeled ? "Model" : undefined} value={model || "Runtime default"} />
        </Box>
      )}
      {showEffort && (
        <Box width={Math.min(stringWidth(effortText), Math.floor(width / 3))} flexShrink={0} overflow="hidden">
          <Setting label={labeled ? "Effort" : undefined} value={effort ?? ""} />
        </Box>
      )}
    </Box>
  );
}

function Setting({ label, value, color = COLORS.text }: { label?: string; value: string; color?: string }) {
  return (
    <Text wrap="truncate-end">
      {label && <Text color={COLORS.secondaryText}>{label} </Text>}
      <Text bold color={color}>{cleanInput(value).replace(/\s+/gu, " ")}</Text>
    </Text>
  );
}

function composerLayout(width: number, compact = false) {
  const framed = !compact && width >= 38;
  const leftRail = width >= 4;
  const padding = width >= 10 ? 1 : 0;
  const marker = width >= 14;
  const borderCells = framed ? 2 : Number(leftRail);
  const editableWidth = Math.max(1, width - borderCells - padding * 2 - (marker ? 2 : 0));
  return { framed, leftRail, padding, marker, editableWidth };
}
