export interface ParsedCommand {
  command: string;
  args: string;
}

export interface CommandDefinition {
  name: string;
  description: string;
  aliases?: string[];
}

export const DICODE_COMMANDS: CommandDefinition[] = [
  { name: "help", description: "Show available commands" },
  { name: "status", description: "Show runtime status" },
  { name: "new", description: "Create a new session" },
  { name: "resume", description: "Resume the most recent session" },
  { name: "model", description: "Open the model picker" },
  { name: "clear", description: "Clear the current view (keeps history)" },
  { name: "quit", description: "Exit Dicode", aliases: ["exit", "q"] },
];

/** Parses a leading slash command. Returns null for ordinary input. */
export function parseCommand(input: string): ParsedCommand | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith("/")) return null;
  const [name, ...rest] = trimmed.slice(1).split(/\s+/);
  if (!name) return null;
  return { command: name.toLowerCase(), args: rest.join(" ") };
}

export function findCommand(name: string): CommandDefinition | undefined {
  return DICODE_COMMANDS.find(
    (cmd) => cmd.name === name || cmd.aliases?.includes(name),
  );
}

export function formatHelp(): string {
  const lines = DICODE_COMMANDS.map((cmd) => `  /${cmd.name.padEnd(8)} ${cmd.description}`);
  return ["DICODE COMMANDS", ...lines].join("\n");
}
