import { useMemo, useState } from "react";
import { Box, Text, useApp, useInput } from "ink";
import type { DicodeCore } from "@dicode/core";
import { COLORS } from "../theme/colors.js";
import { CommandPalette, type Command } from "../components/CommandPalette.js";
import { Header } from "../components/Header.js";
import { Input } from "../components/Input.js";
import { StatusBar } from "../components/StatusBar.js";
import { ApprovalModal } from "../components/ApprovalModal.js";
import { ModelPicker } from "../components/ModelPicker.js";
import { Chat } from "../screens/Chat.js";
import { Welcome } from "../screens/Welcome.js";
import { resolveKeyAction } from "../utils/keyboard.js";
import { parseCommand, findCommand, formatHelp } from "../utils/commands.js";
import { useDicodeApp } from "./useDicodeApp.js";

const COMMANDS: Command[] = [
  { id: "new-session", label: "New Session" },
  { id: "open-current", label: "Open Current Directory" },
  { id: "toggle-sidebar", label: "Toggle Sidebar" },
  { id: "resume-session", label: "Resume Recent Session" },
  { id: "exit", label: "Exit Dicode" },
];

export function App({ cwd, resume, core }: { cwd?: string; resume?: boolean; core?: DicodeCore }) {
  const { exit } = useApp();
  const app = useDicodeApp({ cwd, resume, core });
  const [paletteIndex, setPaletteIndex] = useState(0);
  const [paletteFilter, setPaletteFilter] = useState("");

  const filteredCommands = useMemo(() => {
    const q = paletteFilter.toLowerCase();
    return q ? COMMANDS.filter((c) => c.label.toLowerCase().includes(q)) : COMMANDS;
  }, [paletteFilter]);

  const running = app.state.status === "running" || app.state.status === "waiting_approval";
  const inChat = Boolean(app.state.sessionId);

  useInput((input, key) => {
    // Model picker overlay.
    if (app.state.modelPickerOpen) {
      if (key.escape) {
        app.dispatch({ type: "TOGGLE_MODEL_PICKER" });
        return;
      }
      if (key.upArrow) {
        app.dispatch({ type: "PREV_MODEL" });
        return;
      }
      if (key.downArrow) {
        app.dispatch({ type: "NEXT_MODEL" });
        return;
      }
      if (key.return) {
        const model = app.state.models[app.state.modelIndex];
        if (model) app.dispatch({ type: "SET_SELECTED_MODEL", model: model.model });
        app.dispatch({ type: "TOGGLE_MODEL_PICKER" });
        return;
      }
      return;
    }

    // Command palette takes priority.
    if (app.state.commandPaletteOpen) {
      if (key.escape) {
        app.closePalette();
        setPaletteFilter("");
        return;
      }
      if (key.upArrow) {
        setPaletteIndex((i) => Math.max(0, i - 1));
        return;
      }
      if (key.downArrow) {
        setPaletteIndex((i) => Math.min(filteredCommands.length - 1, i + 1));
        return;
      }
      if (key.return) {
        const command = filteredCommands[paletteIndex];
        if (command) void executeCommand(command.id);
        app.closePalette();
        setPaletteFilter("");
        return;
      }
      if (input && !key.ctrl) {
        setPaletteFilter((f) => f + input);
        setPaletteIndex(0);
        return;
      }
      return;
    }

    // Approval modal.
    if (app.state.approvalModalOpen && app.state.pendingApprovals.length > 0) {
      const approval = app.state.pendingApprovals[0];
      if (input === "a" || input === "A") {
        void app.respondApproval(approval.id, { kind: "approve" });
        return;
      }
      if (input === "d" || input === "D") {
        void app.respondApproval(approval.id, { kind: "deny" });
        return;
      }
      if (key.escape) return;
      return;
    }

    const action = resolveKeyAction({ input, key }, { running, modalOpen: false, inputFocused: true });
    switch (action) {
      case "send":
        if (app.input.trim()) void handleSubmit();
        break;
      case "newline":
        app.setInput(`${app.input}\n`);
        break;
      case "quit":
        exit();
        break;
      case "newSession":
        void app.createSession();
        break;
      case "commandPalette":
        app.togglePalette();
        setPaletteIndex(0);
        setPaletteFilter("");
        break;
      case "toggleSidebar":
        app.toggleSidebar();
        break;
      case "cancel":
        if (running) void app.interrupt();
        break;
      case "historyUp":
      case "historyDown":
      case "scrollUp":
      case "scrollDown":
        // Navigation is a P1 affordance; input focus keeps typing intact.
        break;
      case "close":
        break;
      case "approve":
      case "deny":
        break;
      case "none":
        if (input && !key.ctrl && !key.escape) {
          app.setInput(`${app.input}${input}`);
        } else if (key.backspace) {
          app.setInput(app.input.slice(0, -1));
        }
        break;
    }
  });

  async function executeCommand(id: string) {
    switch (id) {
      case "new-session":
        await app.createSession();
        break;
      case "open-current":
        await app.openCurrentDirectory();
        break;
      case "toggle-sidebar":
        app.toggleSidebar();
        break;
      case "resume-session":
        if (app.state.sessions[0]) await app.resumeSession(app.state.sessions[0].id);
        break;
      case "exit":
        exit();
        break;
    }
  }

  async function handleSubmit() {
    const text = app.input.trim();
    const parsed = parseCommand(text);
    if (parsed) {
      await handleSlashCommand(parsed.command, parsed.args);
      app.setInput("");
      return;
    }
    await app.sendMessage(text, { model: app.state.selectedModel ?? undefined, effort: app.state.selectedEffort ?? undefined });
  }

  async function handleSlashCommand(command: string, _args: string) {
    switch (command) {
      case "help":
        app.dispatch({ type: "SET_NOTICE", message: formatHelp() });
        break;
      case "status":
        app.dispatch({ type: "SET_NOTICE", message: `Status: ${app.state.status}` });
        break;
      case "new":
        await app.createSession();
        break;
      case "resume":
        if (app.state.sessions[0]) await app.resumeSession(app.state.sessions[0].id);
        break;
      case "model":
        await app.listModels();
        app.dispatch({ type: "TOGGLE_MODEL_PICKER" });
        break;
      case "effort":
        app.dispatch({ type: "SET_SELECTED_EFFORT", effort: _args || null });
        break;
      case "clear":
        app.dispatch({ type: "CLEAR_VIEW" });
        break;
      case "quit":
      case "exit":
      case "q":
        exit();
        break;
      default:
        if (!findCommand(command)) {
          app.dispatch({ type: "SET_NOTICE", message: `Unknown command: /${command}. Try /help` });
        }
    }
  }

  if (app.state.status === "initializing") {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color={COLORS.accentBlue}>Initializing Dicode…</Text>
      </Box>
    );
  }

  if (app.state.status === "error" && !app.core) {
    return (
      <Box flexDirection="column" padding={1} borderStyle="single" borderColor={COLORS.error}>
        <Text bold color={COLORS.error}>Failed to start Dicode</Text>
        <Text color={COLORS.text}>{app.state.error}</Text>
        <Text color={COLORS.dim}>Press Ctrl+Q to quit.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Header
        status={app.state.status}
        projectName={app.state.projectName}
        sessionId={app.state.sessionId}
        model={app.core?.getState().sessions.sessions[app.state.sessionId ?? ""]?.model ?? null}
      />
      {inChat ? <Chat state={app.state} /> : <Welcome projectPath={app.state.projectPath} />}
      {app.state.error && <Text color={COLORS.error}>Error: {app.state.error}</Text>}
      {app.state.notice && <Text color={COLORS.warning}>{app.state.notice}</Text>}
      <Input value={app.input} running={running} />
      <StatusBar status={app.state.status} running={running} />
      {app.state.approvalModalOpen && app.state.pendingApprovals[0] && (
        <ApprovalModal approval={app.state.pendingApprovals[0]} />
      )}
      {app.state.commandPaletteOpen && (
        <CommandPalette commands={filteredCommands} selectedIndex={paletteIndex} />
      )}
      {app.state.modelPickerOpen && (
        <ModelPicker
          models={app.state.models}
          selectedIndex={app.state.modelIndex}
          currentModel={app.state.selectedModel}
        />
      )}
    </Box>
  );
}
