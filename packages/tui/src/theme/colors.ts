/**
 * Dicode brand palette. Ink accepts hex colors; on terminals without truecolor
 * it degrades gracefully.
 */
export const COLORS = {
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
  dim: "#5A6B87",
} as const;

export type ColorKey = keyof typeof COLORS;
