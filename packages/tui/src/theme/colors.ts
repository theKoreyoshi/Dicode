/**
 * Dicode brand palette. Ink accepts hex colors; on terminals without truecolor
 * it degrades gracefully.
 */
export const COLORS = {
  background: "#080808",
  primaryBackground: "#1F1F1F",
  secondaryBackground: "#292929",
  primaryBlue: "#5B9BFF",
  accentBlue: "#5B9BFF",
  text: "#E8E8E8",
  secondaryText: "#858585",
  border: "#363636",
  success: "#7FC99A",
  warning: "#FFB36B",
  error: "#F17777",
  dim: "#777777",
  commandSelected: "#FFB58F",
} as const;

export type ColorKey = keyof typeof COLORS;
