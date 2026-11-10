import { Box, Text } from "ink";
import type { SessionInfo } from "@dicode/core";
import type { UiTokenUsage, UiTool } from "../state/ui-store.js";
import { COLORS } from "../theme/colors.js";
import { cleanInput } from "../utils/composer.js";

interface SidebarProps {
  session?: SessionInfo;
  projectName: string | null;
  projectPath: string | null;
  tools: UiTool[];
  diff: string | null;
  tokenUsage: UiTokenUsage | null;
  columns: number;
  rows: number;
}

const compactNumber = new Intl.NumberFormat("en", { notation: "compact" });

export function Sidebar({ session, projectName, projectPath, tools, diff, tokenUsage, columns, rows }: SidebarProps) {
  const { additions, deletions, files } = summarizeDiff(diff);
  const runningTools = tools.filter((tool) => tool.status === "running").length;
  const context = tokenUsage?.modelContextWindow;

  return (
    <Box
      width={columns}
      height={rows}
      flexShrink={0}
      flexDirection="column"
      paddingLeft={1}
      borderStyle="single"
      borderTop={false}
      borderBottom={false}
      borderRight={false}
      borderColor={COLORS.border}
      overflow="hidden"
    >
      <Text bold color={COLORS.text} wrap="truncate-end">{cleanInput(session?.title || projectName || "Session").replace(/\s+/gu, " ")}</Text>
      {projectPath && <Text color={COLORS.secondaryText} wrap="truncate-start">{cleanInput(projectPath).replace(/\n/gu, " ")}</Text>}
      {tokenUsage && rows > 4 && (
        <Text color={COLORS.secondaryText} wrap="truncate-end">
          {compactNumber.format(tokenUsage.totalTokens)} tokens
          {context ? ` · ${Math.round(tokenUsage.totalTokens / context * 100)}% context` : ""}
        </Text>
      )}
      {rows > 7 && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold color={COLORS.text}>Activity</Text>
          {tools.length ? (
            <Text color={COLORS.secondaryText} wrap="truncate-end">
              {tools.length} tool {tools.length === 1 ? "call" : "calls"}{runningTools ? ` · ${runningTools} running` : ""}
            </Text>
          ) : (
            <Text color={COLORS.secondaryText}>No tools used</Text>
          )}
        </Box>
      )}
      {rows > 11 && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold color={COLORS.text}>Turn changes</Text>
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
      {rows > 13 && (
        <Box marginTop={1}>
          <Text color={COLORS.secondaryText} wrap="truncate-end">Ctrl+X B Hide sidebar</Text>
        </Box>
      )}
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
