import { Box } from "ink";
import type { UiMessage } from "../state/ui-store.js";
import { Message } from "./Message.js";

export function MessageList({ messages }: { messages: UiMessage[] }) {
  return (
    <Box flexDirection="column" flexGrow={1}>
      {messages.map((m) => (
        <Message key={m.id} message={m} />
      ))}
    </Box>
  );
}
