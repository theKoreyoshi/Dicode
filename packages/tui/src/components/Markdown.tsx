import { Box, Text } from "ink";
import { COLORS } from "../theme/colors.js";
import { highlightLine, parseMarkdown } from "../utils/markdown.js";

export function Markdown({ content }: { content: string }) {
  const blocks = parseMarkdown(content);
  return (
    <Box flexDirection="column">
      {blocks.map((block, i) => (
        <MarkdownBlock key={i} block={block} />
      ))}
    </Box>
  );
}

function MarkdownBlock({ block }: { block: ReturnType<typeof parseMarkdown>[number] }) {
  switch (block.type) {
    case "heading":
      return <Text bold color={COLORS.primaryBlue}>{block.text}</Text>;
    case "paragraph":
      return <Text color={COLORS.text}>{block.text}</Text>;
    case "code":
      return (
        <Box flexDirection="column" borderStyle="single" borderColor={COLORS.border} paddingX={1}>
          {block.language ? <Text color={COLORS.dim}>{block.language}</Text> : null}
          {block.code.split("\n").map((line, idx) => (
            <Box key={idx} flexDirection="row">
              {highlightLine(line, block.language).map((segment, sIdx) => (
                <Text key={sIdx} color={segment.color}>{segment.text}</Text>
              ))}
            </Box>
          ))}
        </Box>
      );
    case "list":
      return (
        <Box flexDirection="column">
          {block.items.map((item, idx) => (
            <Text key={idx} color={COLORS.text}>
              {block.ordered ? `${idx + 1}. ${item}` : `• ${item}`}
            </Text>
          ))}
        </Box>
      );
    case "quote":
      return <Text color={COLORS.secondaryText}>│ {block.text}</Text>;
    case "hr":
      return <Text color={COLORS.dim}>──────────────</Text>;
  }
}
