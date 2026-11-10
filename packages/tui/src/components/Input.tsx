import { Box, Text } from "ink";
import { COLORS } from "../theme/colors.js";
import { composerLines } from "../utils/composer.js";

export const COMPOSER_MAX_WIDTH = 75;

export function Input({ value, cursor, width, maxRows, focused, running, mode, model, effort, queued }: {
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
}) {
  const accent = mode === "plan" ? COLORS.warning : COLORS.accentBlue;
  const lines = composerLines(value, cursor, Math.max(4, width - 4), maxRows);
  return (
    <Box
      flexDirection="column" width={width} flexShrink={0} paddingX={1}
      borderStyle="single" borderColor={accent}
      borderTop={false} borderBottom={false} borderRight={false}
    >
      {value ? lines.map((line, index) => (
        <Text key={index} wrap="truncate-end" color={COLORS.text} backgroundColor={COLORS.primaryBackground}>
          {line.before}
          {line.cursor !== undefined && <Text inverse={focused}>{line.cursor}</Text>}
          {line.after}
          {!line.before && !line.cursor && !line.after && " "}
        </Text>
      )) : (
        <Text wrap="truncate-end" color={COLORS.secondaryText} backgroundColor={COLORS.primaryBackground}>
          {focused && <Text inverse> </Text>}
          {running ? " Send a follow-up…" : " Ask Dicode about your project…"}
        </Text>
      )}
      <Text wrap="truncate-end" color={COLORS.secondaryText}>
        <Text bold color={accent}>{mode === "plan" ? "Plan" : "Build"}</Text>
        {"  "}{model ?? "Default model"}{effort && `  ·  ${effort}`}
      </Text>
      {queued && <Text wrap="truncate-end" color={COLORS.warning}>Queued · {queued.split("\n", 1)[0]}</Text>}
    </Box>
  );
}
