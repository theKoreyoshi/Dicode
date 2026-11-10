export const PRODUCT_NAME = "Dicode";
export const PRODUCT_VERSION = "0.1.0";
export const BUNDLED_CODEX_VERSION = "0.167.0";
export const BUNDLED_CODEX_EXECUTABLE = "bin/codex.exe";
export const BUNDLED_CODEX_FILES = [
  "codex-package.json",
  BUNDLED_CODEX_EXECUTABLE,
  "bin/codex-code-mode-host.exe",
  "bin/codex-exec-server.exe",
  "codex-resources/codex-command-runner.exe",
  "codex-resources/codex-windows-sandbox-setup.exe",
  "codex-path/rg.exe",
] as const;
export const PRODUCT_TAGLINE = "AI Coding Agent for Developers";

/** Verified Codex App Server version used during Phase 1 validation. */
export const CODEX_APP_SERVER_VERSION = "0.167.0-alpha.3.2";

/** Dicode brand palette (deep blue pixel-terminal theme). */
export const BRAND_COLORS = {
  background: "#080E1C",
  primaryBackground: "#0D1629",
  secondaryBackground: "#111F38",
  primaryBlue: "#258BFF",
  accentBlue: "#43C7FF",
  text: "#E1EAF8",
  secondaryText: "#91A8C9",
  border: "#263D61",
  success: "#35C98A",
  warning: "#E9B65B",
  error: "#F16B78",
} as const;

/** Preferred monospace font stack with graceful fallbacks. */
export const FONT_STACK = [
  "Cascadia Code",
  "Cascadia Mono",
  "JetBrains Mono",
  "Consolas",
  "monospace",
] as const;
