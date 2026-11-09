import { Box, Text } from "ink";
import { COLORS } from "../theme/colors.js";
import type { UiMessage } from "../state/ui-store.js";
import { Markdown } from "./Markdown.js";

export function Message({ message }: { message: UiMessage }) {
  const isUser = message.role === "user";
  const label = isUser ? "YOU" : "DICODE";
  const color = isUser ? COLORS.primaryBlue : COLORS.accentBlue;
  return (
    <Box flexDirection="column" marginY={1}>
      <Text bold color={color}>{label}</Text>
      {isUser ? (
        <Text color={COLORS.text}>{message.content}</Text>
      ) : (
        <Markdown content={message.content} />
      )}
      {message.streaming && <Text color={COLORS.accentBlue}>▌</Text>}
    </Box>
  );
}
