import { Box, Text } from "ink";
import { PRODUCT_VERSION } from "@dicode/shared";
import type { UiTokenUsage } from "../state/ui-store.js";
import { COLORS } from "../theme/colors.js";
import { cleanInput } from "../utils/composer.js";
import { contextUsagePercent, formatContextUsage } from "../utils/token-usage.js";

interface SidebarProps {
  sessionTitle: string | null;
  projectName: string | null;
  projectPath: string | null;
  diff: string | null;
  tokenUsage: UiTokenUsage | null;
  rows: number;
}

export function Sidebar({ sessionTitle, projectName, projectPath, diff, tokenUsage, rows }: SidebarProps) {
  const { additions, deletions, files } = summarizeDiff(diff);
  const contextPercent = tokenUsage ? contextUsagePercent(tokenUsage) : null;

  return (
    <Box
      width={42}
      height={rows}
      flexShrink={0}
      flexDirection="column"
      paddingLeft={2}
      borderStyle="single"
      borderTop={false}
      borderBottom={false}
      borderRight={false}
      borderColor={COLORS.border}
      overflow="hidden"
    >
      <Text bold color={COLORS.text} wrap="truncate-end">{cleanInput(sessionTitle || projectName || "Session").replace(/\s+/gu, " ")}</Text>
      {tokenUsage && rows > 5 && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold color={COLORS.text}>Context</Text>
          <Text color={COLORS.secondaryText} wrap="truncate-end">
            {formatContextUsage(tokenUsage)}
          </Text>
          {contextPercent !== null && <Text color={COLORS.secondaryText}>active context</Text>}
        </Box>
      )}
      {rows > 17 && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold color={COLORS.text}>Changes</Text>
          {diff ? (
            <Text color={COLORS.secondaryText} wrap="truncate-end">
              {files > 0 && `${files} ${files === 1 ? "file" : "files"} · `}
              <Text color={COLORS.success}>+{additions}</Text>
              {" "}
              <Text color={COLORS.error}>−{deletions}</Text>
            </Text>
          ) : (
            <Text color={COLORS.secondaryText}>No changes reported</Text>
          )}
        </Box>
      )}
      {rows > 22 && (
        <Box flexGrow={1} />
      )}
      {projectPath && <Text color={COLORS.text} wrap="truncate-start">{cleanInput(projectPath).replace(/\n/gu, " ")}</Text>}
      <Text color={COLORS.secondaryText}><Text color={COLORS.success}>●</Text> Dicode {PRODUCT_VERSION}</Text>
    </Box>
  );
}

function summarizeDiff(diff: string | null) {
  let files = 0;
  let additions = 0;
  let deletions = 0;
  let inHunk = false;
  for (const line of diff?.split(/\r?\n/) ?? []) {
    if (line.startsWith("diff --git ")) {
      files++;
      inHunk = false;
    } else if (line.startsWith("@@ ")) {
      inHunk = true;
    } else if (inHunk) {
      if (line.startsWith("+")) additions++;
      if (line.startsWith("-")) deletions++;
    }
  }
  return { files, additions, deletions };
}
