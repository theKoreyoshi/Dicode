import { Box } from "ink";
import type { ReactNode } from "react";
import { Sidebar } from "../components/Sidebar.js";
import { MessageList } from "../components/MessageList.js";
import type { UiState } from "../state/ui-store.js";

interface ChatProps {
  state: UiState;
  columns?: number;
  rows?: number;
  scrollOffset?: number;
  showToolDetails?: boolean;
  composer?: ReactNode;
  composerHeight?: number;
  footer?: ReactNode;
  onScrollLimitChange?: (limit: number, rowDelta: number) => void;
}

export function Chat({
  state,
  columns = 80,
  rows = 18,
  scrollOffset = 0,
  showToolDetails = false,
  composer,
  composerHeight = 0,
  footer,
  onScrollLimitChange,
}: ChatProps) {
  const contextVisible = state.sidebarVisible && columns >= 100;
  const contextWidth = contextVisible ? 42 : 0;
  const contentPadding = columns < 44 ? 1 : 2;
  const mainWidth = Math.max(1, columns - contextWidth);
  const messageColumns = Math.max(1, mainWidth - contentPadding * 2);
  const transcriptRows = Math.max(1, rows - composerHeight - Number(Boolean(footer)));
  const session = state.sessions.find((entry) => entry.id === state.sessionId);
  return (
    <Box width={columns} flexDirection="row" height={rows} flexShrink={0} overflow="hidden">
      <Box width={mainWidth} height={rows} flexDirection="column" paddingX={contentPadding} overflow="hidden">
        <MessageList
          messages={state.messages}
          tools={state.tools}
          thoughts={state.thoughts}
          plan={state.plan}
          columns={messageColumns}
          rows={transcriptRows}
          scrollOffset={scrollOffset}
          showToolDetails={showToolDetails}
          working={state.status === "running" || state.status === "waiting_approval"}
          onScrollLimitChange={onScrollLimitChange}
        />
        {composer}
        {footer}
      </Box>
      {contextVisible && (
        <Sidebar
          sessionTitle={session?.title ?? null}
          projectName={state.projectName}
          projectPath={state.projectPath}
          diff={state.diff}
          tokenUsage={state.tokenUsage}
          rows={rows}
        />
      )}
    </Box>
  );
}
