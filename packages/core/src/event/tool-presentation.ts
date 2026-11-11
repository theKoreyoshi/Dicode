/**
 * Displayable parts of native Codex tool items, shared by live and persisted transcripts.
 */
export function readToolPresentation(item: unknown, progress?: string | null): { label?: string; output?: string } {
  const value = asRecord(item);
  const type = value.type;
  const changes = Array.isArray(value.changes) ? value.changes.map(asRecord) : [];
  const firstPath = changes[0]?.path;
  const fileLabel = typeof firstPath === "string" ? firstPath + (changes.length > 1 ? ` +${changes.length - 1}` : "") : undefined;
  const qualifier = type === "mcpToolCall" ? value.server : type === "dynamicToolCall" ? value.namespace : undefined;
  const toolName = typeof value.tool === "string" && typeof qualifier === "string" && qualifier
    ? `${qualifier}/${value.tool}`
    : value.tool;
  const label = [value.command, toolName, value.query, value.name, fileLabel]
    .find((candidate): candidate is string => typeof candidate === "string" && candidate.length > 0);
  const result = asRecord(value.result);
  const error = typeof value.error === "string" ? value.error : asRecord(value.error).message;
  let output: string | undefined;
  if (typeof value.aggregatedOutput === "string" && value.aggregatedOutput) {
    output = value.aggregatedOutput;
  } else if (typeof error === "string") {
    output = error;
  } else if (type === "mcpToolCall") {
    output = renderContent(result.content) || (result.structuredContent == null ? undefined : JSON.stringify(result.structuredContent));
  } else if (type === "dynamicToolCall") {
    output = renderContent(value.contentItems);
  } else if (changes.length > 0) {
    output = changes.map(({ path, diff }) => [path, diff].filter((part) => typeof part === "string" && part).join("\n"))
      .filter(Boolean).join("\n\n");
  } else if (typeof value.result === "string") {
    output = value.result;
  }
  if (type === "mcpToolCall" && progress?.trimEnd() && output) output = `${progress.trimEnd()}\n${output}`;
  return { label, output: output?.slice(-16_000) };
}

/** The schema keeps some invocation fields beside `arguments` (not inside it). */
export function readToolInput(item: unknown): Record<string, unknown> | undefined {
  const value = asRecord(item);
  const input: Record<string, unknown> = {};
  if (value.arguments !== undefined && value.arguments !== null) input.arguments = value.arguments;
  for (const key of ["command", "cwd", "source", "commandActions", "server", "namespace", "tool", "query", "path", "prompt", "model", "reasoningEffort"]) {
    if (value[key] !== undefined && value[key] !== null) input[key] = value[key];
  }
  if (Array.isArray(value.changes)) {
    input.files = value.changes.map((change) => {
      const entry = asRecord(change);
      return { path: entry.path, kind: entry.kind };
    });
  }
  return Object.keys(input).length ? input : undefined;
}

function renderContent(content: unknown): string | undefined {
  if (!Array.isArray(content)) return undefined;
  const output = content.map((part) => {
    if (typeof part === "string") return part;
    const item = asRecord(part);
    if (typeof item.text === "string") return item.text;
    switch (item.type) {
      case "image":
      case "inputImage":
        return "[image]";
      case "audio":
      case "inputAudio":
        return "[audio]";
      case "resource": {
        const resource = asRecord(item.resource);
        return typeof resource.text === "string" ? resource.text : "[resource]";
      }
      case "resource_link":
        return typeof item.uri === "string" ? item.uri : "[resource link]";
      default:
        return "";
    }
  }).filter(Boolean).join("\n");
  return output || undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}
