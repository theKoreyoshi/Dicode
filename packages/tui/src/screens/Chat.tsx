import { Box } from "ink";
import { Sidebar } from "../components/Sidebar.js";
import { MessageList } from "../components/MessageList.js";
import type { UiState } from "../state/ui-store.js";

interface ChatProps {
  state: UiState;
  columns?: number;
  rows?: number;
  scrollOffset?: number;
  showToolDetails?: boolean;
  onScrollLimitChange?: (limit: number) => void;
}

export function Chat({
  state,
  columns = 80,
  rows = 18,
  scrollOffset = 0,
  showToolDetails = false,
  onScrollLimitChange,
}: ChatProps) {
  const padding = columns < 44 ? 1 : 2;
  const sidebarColumns = state.sidebarVisible && columns >= 92 ? 28 : 0;
  const gap = sidebarColumns ? 2 : 0;
  const messageColumns = Math.max(1, columns - padding * 2 - sidebarColumns - gap);
  const session = state.sessions.find((entry) => entry.id === state.sessionId);

  return (
    <Box flexDirection="row" height={rows} paddingX={padding} gap={gap} overflow="hidden">
      <MessageList
        messages={state.messages}
        tools={state.tools}
        columns={messageColumns}
        rows={rows}
        scrollOffset={scrollOffset}
        showToolDetails={showToolDetails}
        onScrollLimitChange={onScrollLimitChange}
      />
      {sidebarColumns > 0 && (
        <Sidebar
          session={session}
          projectName={state.projectName}
          projectPath={state.projectPath}
          tools={state.tools}
          diff={state.diff}
          tokenUsage={state.tokenUsage}
          columns={sidebarColumns}
          rows={rows}
        />
      )}
    </Box>
  );
}
