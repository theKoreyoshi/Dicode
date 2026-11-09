export interface CliOptions {
  cwd?: string;
  resume: boolean;
  help: boolean;
  version: boolean;
  doctor: boolean;
}

export function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { resume: false, help: false, version: false, doctor: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--help":
      case "-h":
        options.help = true;
        break;
      case "--version":
      case "-v":
        options.version = true;
        break;
      case "--doctor":
        options.doctor = true;
        break;
      case "--resume":
      case "-r":
        options.resume = true;
        break;
      case "--cwd":
      case "-c":
        options.cwd = argv[++i];
        break;
      default:
        if (arg.startsWith("--cwd=")) options.cwd = arg.slice("--cwd=".length);
        break;
    }
  }
  return options;
}

export const HELP_TEXT = `Dicode — AI Coding Agent for Developers

Usage:
  dicode                Start the Dicode terminal UI
  dicode --cwd <path>   Start in the given project directory
  dicode --resume       Resume the most recent session
  dicode --help         Show this help
  dicode --version      Show version
  dicode --doctor       Run environment diagnostics
`;
