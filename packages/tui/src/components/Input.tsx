import type { ReactNode } from "react";
import { Box, Text } from "ink";
import stringWidth from "string-width";
import wrapAnsi from "wrap-ansi";
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
  return composerLines(value, cursor, layout.editableWidth, maxRows).length + layout.verticalPadding * 2 + 1 + Number(Boolean(queued));
}

export function Input({ value, cursor, width, maxRows, focused, running, mode, model, effort, queued, compact }: InputProps) {
  const layout = composerLayout(width, compact);
  const accent = focused ? COLORS.accentBlue : COLORS.border;
  const lines = composerLines(value, cursor, layout.editableWidth, maxRows);
  const prompt = running ? "Ask anything…" : 'Ask anything… "Fix broken tests"';
  const blank = " ".repeat(Math.max(0, width - 1));
  return (
    <Box flexDirection="column" width={width} flexShrink={0}>
      {layout.verticalPadding > 0 && <ComposerRow width={width} accent={accent}>{blank}</ComposerRow>}
      {value ? lines.map((line, index) => {
        const content = line.before + (line.cursor ?? "") + line.after;
        return (
          <ComposerRow key={index} width={width} accent={accent}>
            {" ".repeat(layout.padding)}
            {line.before}
            {line.cursor !== undefined && <Text inverse={focused}>{line.cursor}</Text>}
            {line.after}
            {" ".repeat(layout.padding)}
            {" ".repeat(Math.max(0, layout.editableWidth - stringWidth(content)))}
          </ComposerRow>
        );
      }) : (
        <ComposerRow width={width} accent={accent} color={COLORS.secondaryText}>
          {" ".repeat(layout.padding)}
          <Text inverse={focused}> </Text>
          {prompt}
          {" ".repeat(layout.padding)}
          {" ".repeat(Math.max(0, layout.editableWidth - 1 - stringWidth(prompt)))}
        </ComposerRow>
      )}
      {layout.verticalPadding > 0 && <ComposerRow width={width} accent={accent}>{blank}</ComposerRow>}
      <ComposerSettings width={width} accent={accent} mode={mode} model={model} effort={effort} />
      {queued && (
        <Box height={1} paddingX={layout.padding} overflow="hidden">
          <Text wrap="truncate-end" color={COLORS.warning}>Queued · {cleanInput(queued).split("\n", 1)[0]}</Text>
        </Box>
      )}
    </Box>
  );
}

function ComposerRow({ width, accent, color = COLORS.text, children }: {
  width: number;
  accent: string;
  color?: string;
  children: ReactNode;
}) {
  return (
    <Box width={width} height={1} flexShrink={0} flexDirection="row" overflow="hidden">
      <Text color={accent} bold>┃</Text>
      <Box width={Math.max(1, width - 1)} height={1} flexShrink={0} overflow="hidden">
        <Text wrap="truncate-end" color={color} backgroundColor={COLORS.primaryBackground}>{children}</Text>
      </Box>
    </Box>
  );
}

function ComposerSettings({ width, accent, mode, model, effort }: Pick<InputProps, "width" | "mode" | "model" | "effort"> & { accent: string }) {
  const showEffort = Boolean(effort && width >= 20);
  const modeValue = mode === "plan" ? "Plan" : "Build";
  let modelValue = model && width >= 10 ? cleanInput(model).replace(/\s+/gu, " ") : "";
  const effortValue = showEffort ? cleanInput(effort ?? "").replace(/\s+/gu, " ") : "";
  const contentWidth = Math.max(0, width - 2);
  const modelWidth = Math.max(0, contentWidth - stringWidth(modeValue) - (modelValue ? 3 : 0) - (effortValue ? stringWidth(` · ${effortValue}`) : 0));
  if (modelValue && stringWidth(modelValue) > modelWidth) modelValue = truncateModel(modelValue, modelWidth);
  const content = `${modeValue}${modelValue ? ` · ${modelValue}` : ""}${effortValue ? ` · ${effortValue}` : ""}`;
  return (
    <ComposerRow width={width} accent={accent}>
      {" "}
      <Text bold color={mode === "plan" ? COLORS.warning : COLORS.accentBlue}>{modeValue}</Text>
      {modelValue && <Text><Text color={COLORS.dim}> · </Text><Text bold color={COLORS.text}>{modelValue}</Text></Text>}
      {effortValue && <Text><Text color={COLORS.dim}> · </Text><Text bold color={COLORS.warning}>{effortValue}</Text></Text>}
      {" ".repeat(Math.max(0, contentWidth - stringWidth(content)))}
    </ComposerRow>
  );
}

function truncateModel(value: string, width: number): string {
  if (width < 1) return "";
  if (width === 1) return "…";
  const prefix = wrapAnsi(value, width - 1, { hard: true, wordWrap: false }).split("\n")[0] ?? "";
  return `${prefix.trimEnd()}…`;
}

function composerLayout(width: number, compact = false) {
  const padding = !compact && width >= 4 ? 1 : 0;
  const editableWidth = Math.max(1, width - 1 - padding * 2);
  return { padding, editableWidth, verticalPadding: compact ? 0 : 1 };
}
