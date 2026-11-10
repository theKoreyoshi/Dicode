export interface ParsedCommand {
  command: string;
  args: string;
}

export interface CommandDefinition {
  name: string;
  label: string;
  description: string;
  group: "Session" | "Agent" | "Application";
  aliases?: readonly string[];
  leader?: string;
  shortcut?: string;
  needsSession?: boolean;
}

export const DICODE_COMMANDS = [
  { name: "new", label: "New session", description: "Start a fresh conversation", group: "Session", aliases: ["clear"], leader: "n" },
  { name: "sessions", label: "Switch session", description: "Find and resume a conversation", group: "Session", aliases: ["resume", "continue"], leader: "l", shortcut: "Ctrl+O" },
  { name: "cd", label: "Open project", description: "Open a recent project or enter /cd <directory>", group: "Session" },
  { name: "models", label: "Select model", description: "Choose a model from Codex", group: "Agent", aliases: ["model"], leader: "m" },
  { name: "agents", label: "Select agent", description: "Choose Build or Plan", group: "Agent", leader: "a", shortcut: "Shift+Tab" },
  { name: "effort", label: "Reasoning effort", description: "Choose a reasoning level for the model", group: "Agent", shortcut: "Ctrl+T" },
  { name: "diff", label: "Review changes", description: "View the latest turn diff", group: "Session", needsSession: true },
  { name: "sidebar", label: "Toggle sidebar", description: "Show or hide session details", group: "Session", leader: "b", needsSession: true },
  { name: "tools", label: "Toggle tool details", description: "Expand or collapse tool output", group: "Session", needsSession: true },
  { name: "cancel-queue", label: "Remove queued prompt", description: "Restore the queued prompt to the composer", group: "Session", needsSession: true },
  { name: "status", label: "Runtime status", description: "View connection, project, and permissions", group: "Application", leader: "s" },
  { name: "help", label: "Show help", description: "Browse commands and shortcuts", group: "Application", leader: "h" },
  { name: "quit", label: "Exit Dicode", description: "Close the terminal interface", group: "Application", aliases: ["exit", "q"], shortcut: "Ctrl+Q" },
] as const satisfies readonly CommandDefinition[];

export type CommandName = typeof DICODE_COMMANDS[number]["name"];

export function parseCommand(input: string): ParsedCommand | null {
  const match = /^\/([\w-]+)(?:\s+([\s\S]*))?$/u.exec(input.trim());
  return match ? { command: match[1].toLowerCase(), args: match[2] ?? "" } : null;
}

export function findCommand(name: string): (CommandDefinition & { name: CommandName }) | undefined {
  return DICODE_COMMANDS.find((entry: CommandDefinition) => entry.name === name || entry.aliases?.includes(name));
}

export function findLeaderCommand(key: string): CommandName | undefined {
  return DICODE_COMMANDS.find((entry: CommandDefinition) => entry.leader === key)?.name;
}

export function commandShortcut(command: CommandDefinition): string | undefined {
  return command.shortcut ?? (command.leader ? `Ctrl+X ${command.leader.toUpperCase()}` : undefined);
}

export function formatHelp(): string {
  const lines = DICODE_COMMANDS.map((command) => `  /${command.name.padEnd(13)} ${command.description}`);
  return ["DICODE COMMANDS", ...lines].join("\n");
}

/** Exact prefixes rank above substrings, then matches with gaps. */
export function matchScore(value: string, query: string): number {
  const text = value.toLowerCase();
  const pattern = query.trim().toLowerCase();
  if (!pattern || text.startsWith(pattern)) return 0;
  const index = text.indexOf(pattern);
  if (index !== -1) return index + 1;
  let end = -1;
  for (const letter of pattern) {
    end = text.indexOf(letter, end + 1);
    if (end === -1) return Infinity;
  }
  return text.length + end;
}
