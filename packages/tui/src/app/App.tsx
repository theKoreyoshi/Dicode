import { useEffect, useRef, useState } from "react";
import { resolve } from "node:path";
import { Box, Text, useApp, useStdout } from "ink";
import type { DicodeCore } from "@dicode/core";
import { COLORS } from "../theme/colors.js";
import { Picker, type PickerItem } from "../components/CommandPalette.js";
import { Header } from "../components/Header.js";
import { COMPOSER_MAX_WIDTH, Input } from "../components/Input.js";
import { StatusBar } from "../components/StatusBar.js";
import { ApprovalModal } from "../components/ApprovalModal.js";
import { Chat } from "../screens/Chat.js";
import { Welcome } from "../screens/Welcome.js";
import { resolveKeyAction } from "../utils/keyboard.js";
import {
  commandShortcut, DICODE_COMMANDS, findCommand, findLeaderCommand,
  matchScore, parseCommand, type CommandName,
} from "../utils/commands.js";
import { cleanInput, composerLines, editComposer, fileCompletion, moveBetweenLines } from "../utils/composer.js";
import { useDicodeApp } from "./useDicodeApp.js";
import { useTerminalInput } from "./useTerminalInput.js";

type Dialog = "commands" | "sessions" | "projects" | "models" | "agents" | "effort" | "status" | "diff";
type Mode = "default" | "plan";
const EMPTY_DIALOG = { query: "", index: 0 };

export function App({ cwd, resume, core }: { cwd?: string; resume?: boolean; core?: DicodeCore }) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [size, setSize] = useState(() => ({ columns: stdout.columns || 80, rows: stdout.rows || 24 }));
  const { columns, rows } = size;
  useEffect(() => {
    const resize = () => setSize({ columns: stdout.columns || 80, rows: stdout.rows || 24 });
    stdout.on("resize", resize);
    if (stdout.isTTY) stdout.write("\u001b[?2004h");
    return () => {
      stdout.off("resize", resize);
      if (stdout.isTTY && !stdout.destroyed) stdout.write("\u001b[?2004l");
    };
  }, [stdout]);

  const app = useDicodeApp({ cwd, resume, core });
  const state = app.state;
  const running = state.status === "running" || state.status === "waiting_approval";
  const approval = state.pendingApprovals[0];
  const session = state.sessions.find((item) => item.id === state.sessionId);
  const [mode, setMode] = useState<Mode>("default");
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [picker, setPicker] = useState(EMPTY_DIALOG);
  const [leaderActive, setLeaderActive] = useState(false);
  const leaderTimer = useRef<ReturnType<typeof setTimeout>>();
  const [showToolDetails, setShowToolDetails] = useState(false);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [scrollLimit, setScrollLimit] = useState(0);
  const [cursorPosition, setCursor] = useState(0);
  const cursor = Math.min(cursorPosition, app.input.length);
  const [completionIndex, setCompletionIndex] = useState(0);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [files, setFiles] = useState<{ key: string; paths: string[] } | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const historyBrowse = useRef({ index: -1, draft: "" });

  useEffect(() => () => clearTimeout(leaderTimer.current), []);
  useEffect(() => {
    setScrollOffset(0);
    setDismissed(null);
    historyBrowse.current.index = -1;
  }, [state.sessionId]);

  const commandItems = DICODE_COMMANDS.flatMap((command) => (
    "needsSession" in command && !state.sessionId ? [] : [{
      id: command.name, label: command.label, detail: `/${command.name} · ${command.group}`,
      hint: commandShortcut(command), aliases: "aliases" in command ? command.aliases.join(" ") : "",
    }]
  ));
  const activeModelId = state.selectedModel ?? session?.model ?? app.core?.getConfig().agent.defaultModel ??
    state.models.find((item) => item.isDefault)?.model ?? null;
  const activeModel = state.models.find((item) => item.model === activeModelId);
  const efforts = activeModel?.supportedReasoningEfforts ?? [];
  const activeEffort = state.selectedEffort ?? activeModel?.defaultReasoningEffort ?? app.core?.getConfig().agent.reasoningEffort ?? null;
  const activeDialog = approval ? null : dialog;
  const dialogItems: PickerItem[] = ({
    commands: commandItems,
    sessions: state.sessions.map((item) => ({
      id: item.id, label: item.title, detail: item.projectPath, hint: item.id === state.sessionId ? "current" : undefined,
    })),
    projects: activeDialog === "projects" ? (app.core?.listProjects() ?? []).map((item) => ({
      id: item.path, label: item.name, detail: item.path, hint: item.path === state.projectPath ? "current" : undefined,
    })) : [],
    models: state.models.filter((item) => !item.hidden).map((item) => ({
      id: item.model, label: item.displayName ?? item.model, detail: item.description,
      hint: item.model === activeModelId ? "current" : undefined,
    })),
    agents: [{ id: "default", label: "Build", detail: "Implement and verify changes" },
      { id: "plan", label: "Plan", detail: "Explore the project and plan changes" }],
    effort: efforts.map((item) => ({
      id: item.reasoningEffort, label: item.reasoningEffort, detail: item.description,
      hint: item.reasoningEffort === activeEffort ? "current" : undefined,
    })),
    status: [],
    diff: [],
  })[activeDialog ?? "commands"];
  const filtered = filterItems(dialogItems, picker.query);
  const selectedIndex = Math.min(picker.index, Math.max(0, filtered.length - 1));

  const fileToken = !activeDialog && !approval && dismissed !== app.input ? fileCompletion(app.input, cursor) : null;
  const fileQuery = fileToken?.query ?? null;
  const fileKey = fileQuery !== null && state.projectPath ? `${state.projectPath}\0${fileQuery}` : null;
  const searchCore = app.core;
  useEffect(() => {
    if (!searchCore || fileKey === null || fileQuery === null) return;
    let active = true;
    const timer = setTimeout(() => {
      void searchCore.searchFiles(fileQuery).then(
        (paths) => { if (active) setFiles({ key: fileKey, paths }); },
        () => { if (active) setFiles({ key: fileKey, paths: [] }); },
      );
    }, 90);
    return () => { active = false; clearTimeout(timer); };
  }, [searchCore, fileKey, fileQuery]);

  const slashQuery = !activeDialog && !approval && dismissed !== app.input && cursor === app.input.length
    ? /^\/([\w-]*)$/u.exec(app.input)?.[1] : undefined;
  const slashItems = slashQuery === undefined ? [] : filterItems(commandItems, slashQuery);
  const fileItems = fileKey && files?.key === fileKey ? files.paths.map((path) => ({ id: path, label: path })) : [];
  const suggestions = slashQuery !== undefined ? slashItems : fileItems;
  const suggestionIndex = Math.min(completionIndex, Math.max(0, suggestions.length - 1));
  const suggestionsOpen = slashQuery !== undefined || fileKey !== null;

  const horizontalPadding = columns < 44 ? 1 : 2;
  const composerWidth = Math.min(COMPOSER_MAX_WIDTH, Math.max(1, columns - horizontalPadding * 2));
  const composerMaxRows = Math.max(1, Math.min(5, Math.floor(rows / 4)));
  const suggestionsRows = Math.max(1, Math.min(5, Math.floor(rows / 4)));
  const composerHeight = composerLines(app.input, cursor, Math.max(4, composerWidth - 4), composerMaxRows).length +
    1 + Number(Boolean(state.queuedPrompt)) + (suggestionsOpen ? 1 + Math.max(1, Math.min(suggestionsRows, suggestions.length)) : 0);
  const viewportRows = Math.max(1, rows - 3 - composerHeight);

  function replaceInput(value: string, nextCursor = value.length) {
    app.setInput(value);
    setCursor(nextCursor);
    setCompletionIndex(0);
    setDismissed(null);
  }

  function openDialog(next: Dialog) {
    setDialog(next);
    setPicker(EMPTY_DIALOG);
    if (next === "models" || next === "effort") void app.listModels();
    if (next === "sessions") app.reloadSessions();
  }

  function chooseModel(id: string) {
    app.dispatch({ type: "SET_SELECTED_MODEL", model: id });
    app.dispatch({ type: "SET_SELECTED_EFFORT", effort: null });
  }

  function chooseEffort(id: string) {
    app.dispatch({ type: "SET_SELECTED_EFFORT", effort: id });
  }

  function runCommand(name: CommandName, args = "") {
    switch (name) {
      case "new": void app.createSession(); break;
      case "sessions": openDialog("sessions"); break;
      case "cd":
        if (args) void app.openProject(resolve(state.projectPath ?? process.cwd(), unquote(args)));
        else openDialog("projects");
        break;
      case "models": openDialog("models"); break;
      case "agents": openDialog("agents"); break;
      case "effort":
        if (args && efforts.some((item) => item.reasoningEffort === args)) chooseEffort(args);
        else openDialog("effort");
        break;
      case "sidebar": app.toggleSidebar(); break;
      case "tools": setShowToolDetails((visible) => !visible); break;
      case "cancel-queue": app.cancelQueuedPrompt(); break;
      case "diff": openDialog("diff"); break;
      case "status": openDialog("status"); break;
      case "help": openDialog("commands"); break;
      case "quit": exit(); break;
    }
  }

  function choose(item: PickerItem) {
    setDialog(null);
    switch (activeDialog) {
      case "commands": {
        const command = findCommand(item.id);
        if (command) runCommand(command.name);
        break;
      }
      case "sessions": void app.resumeSession(item.id); break;
      case "projects": void app.openProject(item.id); break;
      case "models": chooseModel(item.id); break;
      case "agents": setMode(item.id === "plan" ? "plan" : "default"); break;
      case "effort": chooseEffort(item.id); break;
    }
  }

  function completeSuggestion(run: boolean) {
    const item = suggestions[suggestionIndex];
    if (!item) return;
    if (slashQuery !== undefined) {
      const command = findCommand(item.id);
      if (command && run) {
        replaceInput("");
        runCommand(command.name);
      } else {
        replaceInput(`/${item.id} `);
      }
    } else if (fileToken) {
      const path = item.id.replaceAll("\\", "/");
      const mention = /\s/u.test(path) ? `@"${path}" ` : `@${path} `;
      replaceInput(app.input.slice(0, fileToken.start) + mention + app.input.slice(cursor), fileToken.start + mention.length);
    }
  }

  async function submit(queue = false) {
    const text = app.input.trim();
    if (!text) return;
    const parsed = parseCommand(text);
    if (parsed) {
      const command = findCommand(parsed.command);
      if (command) {
        replaceInput("");
        runCommand(command.name, parsed.args);
        return;
      }
      app.dispatch({ type: "SET_NOTICE", message: `Unknown command /${parsed.command}. Try /help.` });
      return;
    }
    const accepted = await app.sendMessage(text, {
      model: state.selectedModel ?? undefined, effort: state.selectedEffort ?? undefined, mode, queue,
    });
    if (!accepted) return;
    setHistory((entries) => [text, ...entries.filter((entry) => entry !== text)].slice(0, 100));
    historyBrowse.current.index = -1;
    setScrollOffset(0);
  }

  function moveHistory(direction: -1 | 1) {
    const next = moveBetweenLines(app.input, cursor, direction);
    const browse = historyBrowse.current;
    if (browse.index === -1 && next !== undefined) {
      setCursor(next);
      return;
    }
    const entries = [...new Set([...history, ...state.messages.filter((message) => message.role === "user")
      .map((message) => message.content).reverse()])];
    if (browse.index === -1) browse.draft = app.input;
    browse.index = Math.max(-1, Math.min(entries.length - 1, browse.index - direction));
    replaceInput(browse.index < 0 ? browse.draft : entries[browse.index]);
  }

  useTerminalInput((input, key, pasted) => {
    const action = pasted ? "none" :
      resolveKeyAction({ input, key }, { running, modalOpen: Boolean(activeDialog), inputFocused: true });
    if (action === "quit") { exit(); return; }
    if (approval) {
      if (key.ctrl && input === "c") void app.interrupt();
      return;
    }
    if (state.status === "initializing" || !app.core) return;
    if (key.ctrl && input === "c" && running) { void app.interrupt(); return; }
    if (activeDialog) {
      if (action === "close" || action === "commandPalette" && activeDialog === "commands") {
        setDialog(null);
        return;
      }
      if (activeDialog === "status") return;
      if (activeDialog === "diff") {
        const step = Math.max(1, rows - 8);
        const delta = key.pageUp ? -step : key.pageDown ? step : key.upArrow ? -1 : key.downArrow ? 1 : 0;
        const max = Math.max(0, (state.diff?.split("\n").length ?? 0) - step);
        setPicker((current) => ({ ...current, index: Math.max(0, Math.min(max, current.index + delta)) }));
        return;
      }
      if (key.return && filtered[selectedIndex]) choose(filtered[selectedIndex]);
      else if (key.upArrow || key.downArrow) {
        setPicker((current) => ({ ...current, index: Math.max(0, Math.min(filtered.length - 1, selectedIndex + (key.upArrow ? -1 : 1))) }));
      } else {
        setPicker((current) => {
          const query = editComposer(current.query, current.query.length, { input, key }).value.replace(/\n/gu, " ");
          return query === current.query ? current : { query, index: 0 };
        });
      }
      return;
    }
    if (action === "leader") {
      clearTimeout(leaderTimer.current);
      setLeaderActive(true);
      leaderTimer.current = setTimeout(() => setLeaderActive(false), 1500);
      return;
    }
    if (leaderActive) {
      setLeaderActive(false);
      clearTimeout(leaderTimer.current);
      if (key.return) { void submit(true); return; }
      const command = !key.ctrl && findLeaderCommand(input.toLowerCase());
      if (command) runCommand(command);
      return;
    }
    if (key.escape && suggestionsOpen) { setDismissed(app.input); return; }
    if (suggestionsOpen && suggestions.length && (key.upArrow || key.downArrow)) {
      const delta = key.upArrow ? -1 : 1;
      setCompletionIndex((suggestionIndex + delta + suggestions.length) % suggestions.length);
      return;
    }
    switch (action) {
      case "send":
        if (suggestions.length) {
          const exact = slashQuery !== undefined && findCommand(slashQuery);
          if (exact && completionIndex === 0) void submit();
          else completeSuggestion(true);
        } else if (slashQuery !== "") void submit();
        break;
      case "complete": completeSuggestion(false); break;
      case "newline": replaceInput(app.input.slice(0, cursor) + "\n" + app.input.slice(cursor), cursor + 1); break;
      case "newSession": runCommand("new"); break;
      case "commandPalette": openDialog("commands"); break;
      case "sessionPicker": openDialog("sessions"); break;
      case "toggleSidebar": runCommand("sidebar"); break;
      case "cycleAgent": setMode((current) => current === "plan" ? "default" : "plan"); break;
      case "cycleEffort": {
        const index = efforts.findIndex((item) => item.reasoningEffort === activeEffort);
        const next = efforts[(index + 1) % efforts.length];
        if (next) chooseEffort(next.reasoningEffort);
        else openDialog("effort");
        break;
      }
      case "cancel": void app.interrupt(); break;
      case "historyUp": moveHistory(-1); break;
      case "historyDown": moveHistory(1); break;
      case "scrollUp": setScrollOffset((offset) => Math.min(scrollLimit, offset + Math.max(1, viewportRows - 1))); break;
      case "scrollDown": setScrollOffset((offset) => Math.max(0, offset - Math.max(1, viewportRows - 1))); break;
      case "none": {
        const next = editComposer(app.input, cursor, { input, key });
        if (next.value !== app.input) {
          historyBrowse.current.index = -1;
          replaceInput(next.value, next.cursor);
        } else setCursor(next.cursor);
        break;
      }
    }
  });

  if (state.status === "initializing" || !app.core) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color={state.error ? COLORS.error : COLORS.accentBlue}>{state.error ? "Dicode could not start" : "Starting Codex App Server…"}</Text>
        {state.error && <Text color={COLORS.text}>{cleanInput(state.error)}</Text>}
        <Text color={COLORS.secondaryText}>{state.error ? "Run dicode doctor for diagnostics · Ctrl+Q quit" : "Ctrl+Q quit"}</Text>
      </Box>
    );
  }

  const composer = (
    <Box width={composerWidth} flexDirection="column" flexShrink={0}>
      <Input value={app.input} cursor={cursor} width={composerWidth} maxRows={composerMaxRows}
        focused={!approval && !dialog} running={running} mode={mode} model={activeModel?.displayName ?? activeModelId}
        effort={activeEffort} queued={state.queuedPrompt} />
      {suggestionsOpen && <Picker title={slashQuery !== undefined ? "Commands" : "Project files"}
        items={suggestions} selectedIndex={suggestionIndex} rows={suggestionsRows} inline
        empty={slashQuery !== undefined ? "No matching commands" : files?.key === fileKey ? "No matching files" : "Searching…"} />}
    </Box>
  );
  const config = app.core.getConfig();
  const diffStep = Math.max(1, rows - 8);
  return (
    <Box flexDirection="column" width={columns}>
      <Header status={state.status} projectName={state.projectName} sessionId={state.sessionId}
        sessionTitle={session?.title} model={activeModelId} columns={columns} />
      {approval ? (
        <ApprovalModal key={approval.id} approval={approval} rows={rows} columns={columns}
          onDecision={(decision) => app.respondApproval(approval.id, decision)} />
      ) : activeDialog === "status" ? (
        <Box paddingX={1} flexDirection="column">
          <Text color={COLORS.accentBlue} bold>Runtime status</Text>
          <Text wrap="truncate-end">Codex App Server · {app.core.getStatus()}</Text>
          <Text wrap="truncate-end">Project · {state.projectPath ?? process.cwd()}</Text>
          <Text wrap="truncate-end">Model · {activeModelId ?? "Runtime default"}</Text>
          <Text wrap="truncate-end">Runtime · {config.runtime.codexPath ?? "Auto-detected"}</Text>
          <Text color={COLORS.secondaryText}>Esc close</Text>
        </Box>
      ) : activeDialog === "diff" ? (
        <Box paddingX={1} flexDirection="column">
          <Text color={COLORS.accentBlue} bold>Latest turn changes</Text>
          {state.diff ? cleanInput(state.diff).split("\n").slice(picker.index, picker.index + diffStep).map((line, index) => (
            <Text key={index} wrap="truncate-end" color={line.startsWith("+") ? COLORS.success : line.startsWith("-") ? COLORS.error : COLORS.text}>{line || " "}</Text>
          )) : <Text color={COLORS.secondaryText}>No changes reported for this session.</Text>}
          <Text color={COLORS.secondaryText}>↑↓ / PgUp PgDn scroll · Esc close</Text>
        </Box>
      ) : activeDialog ? (
        <Picker title={{ commands: "Commands", sessions: "Sessions", projects: "Projects", models: "Models", agents: "Agents", effort: "Reasoning effort" }[activeDialog]}
          items={filtered} query={picker.query} selectedIndex={selectedIndex}
          rows={Math.max(1, Math.min(12, rows - 9))} empty="No matches" />
      ) : state.sessionId ? (
        <>
          <Chat state={state} columns={columns} rows={viewportRows} scrollOffset={scrollOffset}
            onScrollLimitChange={setScrollLimit} showToolDetails={showToolDetails} />
          <Box paddingX={horizontalPadding}>{composer}</Box>
        </>
      ) : (
        <Welcome projectPath={state.projectPath} columns={columns} rows={Math.max(1, rows - 3)}>{composer}</Welcome>
      )}
      <StatusBar status={state.status} running={running} columns={columns} projectPath={state.projectPath}
        leaderActive={leaderActive} notice={state.error ?? state.notice} />
    </Box>
  );
}

function unquote(value: string) {
  return /^(["'])(.*)\1$/u.exec(value)?.[2] ?? value;
}

function filterItems<T extends PickerItem>(items: T[], query: string): T[] {
  return items.map((item) => ({
    item,
    score: Math.min(matchScore(item.label, query), matchScore(item.id, query),
      matchScore(item.detail ?? "", query), matchScore("aliases" in item ? String(item.aliases) : "", query)),
  })).filter(({ score }) => Number.isFinite(score)).sort((a, b) => a.score - b.score).map(({ item }) => item);
}
