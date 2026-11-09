import { Box } from "ink";
import { Sidebar } from "../components/Sidebar.js";
import { MessageList } from "../components/MessageList.js";
import type { UiState } from "../state/ui-store.js";

export function Chat({ state }: { state: UiState }) {
  return (
    <Box flexDirection="row" flexGrow={1}>
      {state.sidebarVisible && (
        <Sidebar
          sessions={state.sessions}
          currentSessionId={state.sessionId}
          projectName={state.projectName}
          projectPath={state.projectPath}
        />
      )}
      <MessageList messages={state.messages} />
    </Box>
  );
}
