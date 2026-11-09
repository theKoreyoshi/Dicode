import { Box, Text } from "ink";
import type { SessionInfo } from "@dicode/core";
import { COLORS } from "../theme/colors.js";
import { truncate } from "../utils/format.js";

export interface SidebarProps {
  sessions: SessionInfo[];
  currentSessionId: string | null;
  projectName: string | null;
  projectPath: string | null;
}

export function Sidebar({ sessions, currentSessionId, projectName, projectPath }: SidebarProps) {
  return (
    <Box borderStyle="single" borderColor={COLORS.border} width={32} flexDirection="column" paddingX={1}>
      <Text bold color={COLORS.accentBlue}>SESSIONS</Text>
      {sessions.length === 0 ? (
        <Text color={COLORS.dim}>  (none)</Text>
      ) : (
        sessions.map((s) => (
          <Text key={s.id} color={s.id === currentSessionId ? COLORS.text : COLORS.secondaryText}>
            {s.id === currentSessionId ? "> " : "  "}
            {truncate(s.title || s.id, 24)}
          </Text>
        ))
      )}
      <Text> </Text>
      <Text bold color={COLORS.accentBlue}>PROJECT</Text>
      <Text color={COLORS.text}>{projectName ?? "—"}</Text>
      <Text color={COLORS.dim}>{projectPath ? truncate(projectPath, 30) : ""}</Text>
    </Box>
  );
}
