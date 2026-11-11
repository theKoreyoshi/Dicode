import { useEffect, useState } from "react";
import { Box, Text } from "ink";
import type { UiTokenUsage } from "../state/ui-store.js";
import { COLORS } from "../theme/colors.js";
import type { UiStatus } from "../state/ui-store.js";
import { cleanInput } from "../utils/composer.js";
import { formatContextUsage } from "../utils/token-usage.js";

interface StatusBarProps {
  status: UiStatus;
  running: boolean;
  columns?: number;
  notice?: string | null;
  leaderActive?: boolean;
  inputVisible?: boolean;
  projectPath?: string | null;
  tokenUsage?: UiTokenUsage | null;
  version?: string;
  home?: boolean;
  activity?: string;
}

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export function StatusBar({ status, running, columns = 80, notice, leaderActive, inputVisible = true, projectPath, tokenUsage, version = "0.1.0", home = false, activity }: StatusBarProps) {
  const showWorking = running && status === "running" && inputVisible && !notice;
  const [spinner, setSpinner] = useState(0);
  useEffect(() => {
    if (!showWorking) {
      setSpinner(0);
      return;
    }
    const timer = setInterval(() => setSpinner((index) => (index + 1) % SPINNER_FRAMES.length), 80);
    return () => clearInterval(timer);
  }, [showWorking]);

  const message = notice ? cleanInput(notice).split("\n", 1)[0]
    : status === "waiting_approval" ? "Approval required"
    : "";
  const hints = home ? ""
    : leaderActive ? "N New   L Sessions   M Models   B Panel"
    : !inputVisible ? "Esc Back"
    : "ctrl+p commands";
  const location = displayPath(projectPath);
  const tokens = tokenUsage ? formatUsage(tokenUsage) : "";
  const color = notice || status === "waiting_approval" ? COLORS.warning : running ? COLORS.accentBlue : COLORS.secondaryText;
  return (
    <Box height={1} flexShrink={0} paddingX={columns < 44 ? 1 : 2} gap={2} overflow="hidden" flexDirection="row">
      {showWorking && <Text color={COLORS.accentBlue}>{SPINNER_FRAMES[spinner]}</Text>}
      {showWorking && <Text color={COLORS.secondaryText}>{activity ?? "Thinking…"}</Text>}
      {showWorking && <Text color={COLORS.secondaryText}>esc interrupt</Text>}
      <Box minWidth={0} flexGrow={1} flexBasis={0} overflow="hidden">
        <Text color={notice ? color : COLORS.secondaryText} wrap={notice ? "truncate-end" : "truncate-start"}>
          {message && notice ? message : location}
        </Text>
      </Box>
      {message && !notice && <Box flexShrink={0}><Text color={color}>{message}</Text></Box>}
      {tokens && <Box flexShrink={0}><Text color={COLORS.secondaryText}>{tokens}</Text></Box>}
      <Box flexShrink={0}>
        <Text color={COLORS.secondaryText}>{home ? `Dicode ${version}` : hints}</Text>
      </Box>
    </Box>
  );
}

function displayPath(path?: string | null): string {
  if (!path) return "~";
  const normalized = path.replaceAll("\\", "/");
  const home = process.env.USERPROFILE?.replaceAll("\\", "/");
  return home && normalized.toLowerCase().startsWith(home.toLowerCase())
    ? `~${normalized.slice(home.length)}`
    : normalized;
}

function formatUsage(usage: UiTokenUsage): string {
  return formatContextUsage(usage);
}
