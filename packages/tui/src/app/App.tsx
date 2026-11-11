import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { resolve } from "node:path";
import { Box, Text, useApp, useStdout, type Key } from "ink";
import type { DicodeCore } from "@dicode/core";
import { PRODUCT_VERSION } from "@dicode/shared";
import { COLORS } from "../theme/colors.js";
import { Picker, type PickerItem } from "../components/CommandPalette.js";
import { COMPOSER_MAX_WIDTH, Input, measureComposerHeight } from "../components/Input.js";
import { StatusBar } from "../components/StatusBar.js";
import { ApprovalModal } from "../components/ApprovalModal.js";
import { ModelConfig, modelConfigFields, type ModelConfigValues } from "../components/ModelConfig.js";
import { Chat } from "../screens/Chat.js";
import { Welcome } from "../screens/Welcome.js";
import { resolveKeyAction } from "../utils/keyboard.js";
import {
  commandShortcut, DICODE_COMMANDS, findCommand, findLeaderCommand,
  matchScore, parseCommand, type CommandName,
} from "../utils/commands.js";
import { cleanInput, editComposer, fileCompletion, moveBetweenLines } from "../utils/composer.js";
import { useDicodeApp } from "./useDicodeApp.js";
import { useTerminalInput } from "./useTerminalInput.js";

type Dialog = "commands" | "sessions" | "projects" | "models" | "model-config" | "agents" | "effort" | "permissions" | "status" | "diff";
type Mode = "default" | "plan";
const EMPTY_DIALOG = { query: "", index: 0 };
const CONFIGURE_MODEL = "\0model-config";

export function App({ cwd, resume, core }: { cwd?: string; resume?: boolean; core?: DicodeCore }) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [size, setSize] = useState(() => frameSize(stdout));
  const { columns, rows } = size;
  const tooSmall = rows < 7 || columns < 20;
  useLayoutEffect(() => {
    const resize = () => {
      const next = frameSize(stdout);
      setSize((previous) => previous.columns === next.columns && previous.rows === next.rows ? previous : next);
    };
    // Update the viewport before Ink draws using the new terminal geometry.
    stdout.prependListener("resize", resize);
    return () => { stdout.off("resize", resize); };
  }, [stdout]);

  const app = useDicodeApp({ cwd, resume, core });
  const state = app.state;
  const hasSession = Boolean(state.sessionId);
  const bodyRows = Math.max(1, rows - Number(!hasSession));
  const authError = isAuthenticationError(state.error);
  const running = state.status === "running" || state.status === "waiting_approval";
  const approval = state.pendingApprovals[0];
  const session = state.sessions.find((item) => item.id === state.sessionId);
  const [mode, setMode] = useState<Mode>("default");
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [picker, setPicker] = useState(EMPTY_DIALOG);
  const [modelForm, setModelForm] = useState({
    values: { model: "", baseUrl: "", apiKeyEnv: "" } as ModelConfigValues,
    focus: 0, cursor: 0, error: null as string | null,
  });
  const [leaderActive, setLeaderActive] = useState(false);
  const leaderTimer = useRef<ReturnType<typeof setTimeout>>();
  const [showToolDetails, setShowToolDetails] = useState(false);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [scrollLimit, setScrollLimit] = useState(0);
  const updateScrollLimit = useCallback((limit: number, rowDelta = 0) => {
    setScrollLimit(limit);
    setScrollOffset((offset) => offset === 0 ? 0 : clampOffset(offset + rowDelta, limit));
  }, []);
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
      id: command.name, label: `/${command.name}`, detail: command.description,
      hint: commandShortcut(command), aliases: "aliases" in command ? command.aliases.join(" ") : "",
    }]
  ));
  const config = app.core?.getConfig();
  const savedCustomModel = config?.agent.customModel;
  const activeCustomModel = state.sessionId ? session?.customModel : savedCustomModel;
  const activeModelId = activeCustomModel?.model ?? state.selectedModel ?? session?.model ?? config?.agent.defaultModel ??
    state.models.find((item) => item.isDefault)?.model ?? null;
  const activeModel = activeCustomModel ? undefined : state.models.find((item) => item.model === activeModelId);
  const efforts = activeModel?.supportedReasoningEfforts ?? [];
  const activeEffort = activeCustomModel ? null
    : state.selectedEffort ?? activeModel?.defaultReasoningEffort ?? config?.agent.reasoningEffort ?? null;
  const activeDialog = approval ? null : dialog;
  const dialogItems: PickerItem[] = ({
    commands: commandItems,
    sessions: state.sessions.map((item) => ({
      id: item.id, label: item.title, detail: item.projectPath, hint: item.id === state.sessionId ? "current" : undefined,
    })),
    projects: activeDialog === "projects" ? (app.core?.listProjects() ?? []).map((item) => ({
      id: item.path, label: item.name, detail: item.path, hint: item.path === state.projectPath ? "current" : undefined,
    })) : [],
    models: [...(activeCustomModel ? [{
      id: activeCustomModel.model, label: activeCustomModel.model, detail: "Custom provider", hint: "current",
    }] : state.models.filter((item) => !item.hidden).map((item) => ({
      id: item.model, label: item.displayName ?? item.model, detail: item.description,
      hint: item.model === activeModelId ? "current" : undefined,
    }))), { id: CONFIGURE_MODEL, label: "Configure custom model", detail: "/model-config" }],
    "model-config": [],
    agents: [{ id: "default", label: "Build", detail: "Implement and verify changes" },
      { id: "plan", label: "Plan", detail: "Explore the project and plan changes" }],
    permissions: [
      { id: "default", label: "Codex default", detail: "Use the sandbox and approval policy from Codex configuration.", hint: config?.agent.permissionMode !== "full" ? "current" : undefined },
      { id: "full", label: "Allow all", detail: "danger-full-access · disables sandbox and approvals for future turns.", hint: config?.agent.permissionMode === "full" ? "current" : "HIGH RISK" },
    ],
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
  const horizontalPadding = columns < 44 ? 1 : 2;
  const contextWidth = hasSession && state.sidebarVisible && columns >= 100 ? 42 : 0;
  const mainWidth = Math.max(1, columns - contextWidth);
  const composerWidth = Math.min(COMPOSER_MAX_WIDTH, Math.max(1, mainWidth - horizontalPadding * 2));
  const composerProps = {
    value: app.input, cursor, width: composerWidth,
    maxRows: Math.max(1, Math.min(5, Math.floor(bodyRows / 4))),
    compact: rows < 11, queued: state.queuedPrompt,
  };
  const promptRows = measureComposerHeight(composerProps);
  const helperRows = hasSession ? 0 : 1;
  const suggestionsRows = Math.max(0, Math.min(10, bodyRows - promptRows - helperRows - 2));
  const suggestionsOpen = suggestionsRows > 0 && (slashQuery !== undefined || fileKey !== null);
  const visibleSuggestionRows = suggestionsOpen ? Math.max(1, Math.min(suggestionsRows, suggestions.length)) : 0;
  const composerHeight = promptRows + helperRows + visibleSuggestionRows;
  const transcriptRows = Math.max(1, bodyRows - composerHeight - Number(hasSession));
  const pageRows = Math.max(1, bodyRows - 2);
  const diffLines = activeDialog === "diff" && state.diff ? cleanInput(state.diff).split("\n") : [];
  const statusLines = [
    ["Connection", `Codex App Server · ${app.core?.getStatus() ?? "starting"}`],
    ["Project", state.projectPath ?? process.cwd()],
    ["Agent", mode === "plan" ? "Plan" : "Build"],
    ["Model", activeModelId ?? "Runtime default"],
    ...(activeCustomModel ? [["Provider", activeCustomModel.baseUrl]] : []),
    ["Reasoning", activeEffort ?? "Runtime default"],
    ["Permissions", config?.agent.permissionMode === "full" ? "Allow all · danger-full-access" : "Codex default"],
    ["Runtime", config?.runtime.codexPath ?? "Auto-detected"],
    ...(state.error ? [["Error", cleanInput(state.error).split("\n", 1)[0]]] : []),
  ];
  const dialogLimit = Math.max(0, (activeDialog === "diff" ? diffLines.length : statusLines.length) - pageRows);
  const dialogOffset = clampOffset(picker.index, dialogLimit);

  function replaceInput(value: string, nextCursor = value.length) {
    app.setInput(value);
    setCursor(nextCursor);
    setCompletionIndex(0);
    setDismissed(null);
  }

  function openDialog(next: Dialog) {
    setDialog(next);
    setPicker(next === "permissions" && config?.agent.permissionMode === "full"
      ? { query: "", index: 1 } : EMPTY_DIALOG);
    if ((next === "models" || next === "effort") && !activeCustomModel) void app.listModels();
    if (next === "sessions") app.reloadSessions();
    if (next === "model-config") {
      const values = {
        model: savedCustomModel?.model ?? "", baseUrl: savedCustomModel?.baseUrl ?? "", apiKeyEnv: savedCustomModel?.apiKeyEnv ?? "",
      };
      setModelForm({ values, focus: 0, cursor: values.model.length, error: null });
    }
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
      case "model-config": openDialog("model-config"); break;
      case "agents": openDialog("agents"); break;
      case "plan":
        if (running) {
          app.dispatch({ type: "SET_NOTICE", message: "Finish or interrupt the active turn before entering Plan mode." });
          break;
        }
        setMode("plan");
        if (args) {
          replaceInput(args);
          void sendPrompt(args, false, "plan");
        }
        break;
      case "effort":
        if (args && efforts.some((item) => item.reasoningEffort === args)) chooseEffort(args);
        else openDialog("effort");
        break;
      case "permissions": openDialog("permissions"); break;
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
      case "models":
        if (item.id === CONFIGURE_MODEL) openDialog("model-config");
        else if (!activeCustomModel) chooseModel(item.id);
        break;
      case "agents": setMode(item.id === "plan" ? "plan" : "default"); break;
      case "effort": chooseEffort(item.id); break;
      case "permissions": {
        const permissionMode = item.id === "full" ? "full" : "default";
        try {
          app.core?.updateConfig({ agent: { permissionMode } });
          app.dispatch({
            type: "SET_NOTICE",
            message: permissionMode === "full"
              ? "HIGH RISK · allow all enabled for future turns"
              : "Codex permission defaults restored for future turns.",
          });
        } catch (error) {
          app.dispatch({ type: "SET_ERROR", message: error instanceof Error ? error.message : String(error) });
        }
        break;
      }
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
        if (command.name !== "plan" || !running) replaceInput("");
        runCommand(command.name, parsed.args);
        return;
      }
      app.dispatch({ type: "SET_NOTICE", message: `Unknown command /${parsed.command}. Try /help.` });
      return;
    }
    await sendPrompt(text, queue, mode);
  }

  async function sendPrompt(text: string, queue: boolean, promptMode: Mode) {
    const accepted = await app.sendMessage(text, {
      model: activeCustomModel?.model ?? state.selectedModel ?? undefined,
      effort: activeCustomModel ? undefined : state.selectedEffort ?? undefined,
      mode: promptMode, queue,
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

  function scrollTranscript(rowsTowardHistory: number) {
    setScrollOffset((offset) => clampOffset(offset + rowsTowardHistory, scrollLimit));
  }

  function scrollDialog(delta: number) {
    setPicker((current) => {
      const index = clampOffset(clampOffset(current.index, dialogLimit) + delta, dialogLimit);
      return index === current.index ? current : { ...current, index };
    });
  }

  function cycleSession(direction: -1 | 1) {
    const sessions = state.sessions.filter((item) => !item.archived);
    if (sessions.length < 2) return;
    const current = sessions.findIndex((item) => item.id === state.sessionId);
    const next = sessions[(current + direction + sessions.length) % sessions.length];
    if (next) void app.resumeSession(next.id);
  }

  function handleModelConfig(input: string, key: Key) {
    const fieldCount = modelConfigFields.length;
    const optionCount = fieldCount + (savedCustomModel ? 2 : 1);
    if (key.tab || key.upArrow || key.downArrow || key.return && modelForm.focus < fieldCount) {
      const direction = key.upArrow || key.tab && key.shift ? -1 : 1;
      setModelForm((current) => {
        const focus = (current.focus + direction + optionCount) % optionCount;
        const field = modelConfigFields[focus];
        return { ...current, focus, cursor: field ? current.values[field.id].length : 0 };
      });
      return;
    }
    if (key.return) {
      try {
        const { model, baseUrl, apiKeyEnv } = modelForm.values;
        app.saveCustomModel(modelForm.focus === fieldCount ? { model, baseUrl, apiKeyEnv: apiKeyEnv.trim() || undefined } : null);
        setDialog(null);
      } catch (error) {
        setModelForm((current) => ({ ...current, error: error instanceof Error ? error.message : String(error) }));
      }
      return;
    }
    setModelForm((current) => {
      const field = modelConfigFields[current.focus];
      if (!field) return current;
      const next = editComposer(current.values[field.id], current.cursor, { input: input.replace(/[\r\n\t]/gu, ""), key });
      if (next.value.length > field.limit) return current;
      return { ...current, values: { ...current.values, [field.id]: next.value }, cursor: next.cursor, error: null };
    });
  }

  useTerminalInput((input, key, pasted) => {
    const action = pasted ? "none" :
      resolveKeyAction({ input, key }, { running, modalOpen: Boolean(activeDialog), inputFocused: true });
    if (action === "quit") { exit(); return; }
    if (approval) {
      if (key.ctrl && input === "c") void app.interrupt();
      return;
    }
    if (key.ctrl && input === "c" && running) { void app.interrupt(); return; }
    if (tooSmall || state.status === "initializing" || !app.core) return;
    if (activeDialog) {
      if (action === "close" || action === "commandPalette" && activeDialog === "commands") {
        setDialog(null);
        return;
      }
      if (activeDialog === "model-config") {
        handleModelConfig(input, key);
        return;
      }
      if (activeDialog === "diff" || activeDialog === "status") {
        if (activeDialog === "status" && !pasted && !key.ctrl && !key.meta && input.toLowerCase() === "m") {
          openDialog("model-config");
          return;
        }
        const delta = key.pageUp ? -pageRows : key.pageDown ? pageRows : key.upArrow ? -1 : key.downArrow ? 1 : 0;
        if (delta) scrollDialog(delta);
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
        if (suggestionsOpen && suggestions.length) {
          const exact = slashQuery !== undefined && findCommand(slashQuery);
          if (exact && completionIndex === 0) void submit();
          else completeSuggestion(true);
        } else if (slashQuery !== "") void submit();
        break;
      case "complete": if (suggestionsOpen) completeSuggestion(false); break;
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
      case "scrollUp": scrollTranscript(Math.max(1, transcriptRows - 1)); break;
      case "scrollDown": scrollTranscript(-Math.max(1, transcriptRows - 1)); break;
      case "nextSession": cycleSession(1); break;
      case "previousSession": cycleSession(-1); break;
      case "none": {
        const next = editComposer(app.input, cursor, { input, key });
        if (next.value !== app.input) {
          historyBrowse.current.index = -1;
          replaceInput(next.value, next.cursor);
        } else setCursor(next.cursor);
        break;
      }
    }
  }, (direction) => {
    if (tooSmall || approval) return;
    if (activeDialog === "diff" || activeDialog === "status") scrollDialog(direction * 3);
    else if (!activeDialog && state.sessionId) scrollTranscript(-direction * 3);
  });

  if (tooSmall) {
    return <Box width={columns}><Text wrap="truncate-end" color={COLORS.secondaryText}>Resize terminal · Ctrl+Q quit</Text></Box>;
  }

  if (state.status === "initializing" || !app.core) {
    return (
      <Box flexDirection="column" width={columns} height={rows} overflow="hidden" paddingX={1}>
        <Text bold color={state.error ? COLORS.error : COLORS.accentBlue}>{state.error ? "Dicode could not start" : "Starting Codex App Server…"}</Text>
        {state.error && <Text color={COLORS.text}>{cleanInput(state.error)}</Text>}
        {authError && (
          <Text color={COLORS.warning}>Check provider credentials. For ChatGPT sign-in, run dicode login.</Text>
        )}
        <Text color={COLORS.secondaryText}>{state.error ? "Run dicode doctor for diagnostics · Ctrl+Q quit" : "Ctrl+Q quit"}</Text>
      </Box>
    );
  }

  const composer = (
    <Box width={composerWidth} flexDirection="column" flexShrink={0}>
      {suggestionsOpen && <Picker title={slashQuery !== undefined ? "Commands" : "Project files"}
        items={suggestions} selectedIndex={suggestionIndex} rows={visibleSuggestionRows} inline autocomplete width={composerWidth}
        empty={slashQuery !== undefined ? "No matching commands" : files?.key === fileKey ? "No matching files" : "Searching…"} />}
      <Input {...composerProps}
        focused={!approval && !dialog} running={running} mode={mode} model={activeModel?.displayName ?? activeModelId}
        effort={activeEffort} />
      {!hasSession && (
        <Box width={composerWidth} justifyContent="flex-end" flexShrink={0}>
          <Text color={COLORS.secondaryText}>tab agents · ctrl+p commands</Text>
        </Box>
      )}
    </Box>
  );
  const overlayWidth = Math.max(20, Math.min(72, columns - 4));
  const overlayRows = Math.max(3, Math.min(16, rows - 2));
  const overlayTitle = activeDialog === "commands" ? "Commands"
    : activeDialog === "sessions" ? "Sessions"
      : activeDialog === "projects" ? "Projects"
        : activeDialog === "models" ? "Models"
          : activeDialog === "agents" ? "Agents"
            : activeDialog === "effort" ? "Reasoning effort"
              : activeDialog === "permissions" ? "Permission mode" : "";
  const compactStatus = activeDialog === "status" && rows < 12;
  const notice = authError && !activeCustomModel
    ? "Auth · dicode login (ChatGPT) or check credentials"
    : state.error ?? state.notice;
  const activeTool = state.tools.find((tool) => tool.status === "running");
  const activity = activeTool?.type === "commandExecution" ? "Running command…"
    : activeTool?.type === "fileChange" ? "Editing files…"
      : activeTool?.type === "webSearch" ? "Searching…"
        : activeTool ? "Running tool…" : "Thinking…";
  const statusFooter = (
    <StatusBar status={state.status} running={running} columns={mainWidth}
      leaderActive={leaderActive} inputVisible={!activeDialog && !approval} activity={activity}
      projectPath={state.projectPath} tokenUsage={state.tokenUsage} version={PRODUCT_VERSION} notice={notice} />
  );
  return (
    <Box position="relative" flexDirection="column" width={columns} height={rows} overflow="hidden">
      <Box height={bodyRows} flexDirection="column" flexShrink={0} overflow="hidden">
      {approval ? (
        <Chat state={state} columns={columns} rows={bodyRows} scrollOffset={scrollOffset}
          onScrollLimitChange={updateScrollLimit} showToolDetails={showToolDetails} footer={statusFooter} />
      ) : compactStatus ? (
        <>
          <Box height={Math.max(1, bodyRows - 1)} paddingX={1} flexDirection="column" overflow="hidden">
            <Text color={COLORS.accentBlue} bold>Runtime settings</Text>
            {statusLines.slice(dialogOffset, dialogOffset + pageRows).map(([label, value]) => (
              <Text key={label} wrap="truncate-end"><Text color={COLORS.secondaryText}>{label.padEnd(12)}</Text>{cleanInput(value).replace(/\s+/gu, " ")}</Text>
            ))}
            <Text wrap="truncate-end" color={COLORS.secondaryText}>M configure model · ↑↓ scroll · Esc close</Text>
          </Box>
          {statusFooter}
        </>
      ) : state.sessionId ? (
        <Chat state={state} columns={columns} rows={bodyRows} scrollOffset={scrollOffset}
          onScrollLimitChange={updateScrollLimit} showToolDetails={showToolDetails}
          composer={composer} composerHeight={composerHeight} footer={statusFooter} />
      ) : (
        <Welcome columns={columns} rows={bodyRows} composerHeight={composerHeight} projectPath={state.projectPath}>{composer}</Welcome>
      )}
      </Box>
      {!hasSession && <StatusBar status={state.status} running={running} columns={columns}
        projectPath={state.projectPath} version={PRODUCT_VERSION} home notice={notice} />}
      {(approval || activeDialog && !compactStatus) && (
        <Box position="absolute" width={columns} height={rows} alignItems="center" justifyContent="center" overflow="hidden">
          {approval ? (
            <ApprovalModal key={approval.id} approval={approval} rows={overlayRows} columns={overlayWidth}
              onDecision={(decision) => app.respondApproval(approval.id, decision)} />
          ) : (
            <Box width={overlayWidth} height={overlayRows} flexDirection="column" paddingX={1} paddingY={1}
              borderStyle="single" borderColor={COLORS.border} overflow="hidden">
              {activeDialog === "model-config" ? (
                <ModelConfig {...modelForm} rows={overlayRows - 2} columns={overlayWidth - 2} enabled={Boolean(savedCustomModel)} />
              ) : activeDialog === "status" ? (
                <Box flexDirection="column">
                  <Text color={COLORS.accentBlue} bold>Runtime settings</Text>
                  {statusLines.slice(dialogOffset, dialogOffset + Math.max(1, overlayRows - 5)).map(([label, value]) => (
                    <Text key={label} wrap="truncate-end"><Text color={COLORS.secondaryText}>{label.padEnd(12)}</Text>{cleanInput(value).replace(/\s+/gu, " ")}</Text>
                  ))}
                  <Text wrap="truncate-end" color={COLORS.secondaryText}>M configure model · ↑↓ scroll · Esc close</Text>
                </Box>
              ) : activeDialog === "diff" ? (
                <Box flexDirection="column">
                  <Text color={COLORS.accentBlue} bold>Latest turn changes</Text>
                  {diffLines.length ? diffLines.slice(dialogOffset, dialogOffset + Math.max(1, overlayRows - 5)).map((line, index) => (
                    <Text key={index} wrap="truncate-end" color={line.startsWith("+") ? COLORS.success : line.startsWith("-") ? COLORS.error : COLORS.text}>{line || " "}</Text>
                  )) : <Text color={COLORS.secondaryText}>No changes reported for this session.</Text>}
                  <Text wrap="truncate-end" color={COLORS.secondaryText}>↑↓ / PgUp PgDn scroll · Esc close</Text>
                </Box>
              ) : (
                <>
                  <Picker title={overlayTitle} items={filtered} query={picker.query} selectedIndex={selectedIndex}
                    rows={Math.max(1, Math.min(8, overlayRows - 8))} empty="No matches" inline width={overlayWidth - 4} />
                  <Text wrap="truncate-end" color={COLORS.dim}>↑↓ navigate · Enter select · Esc close</Text>
                </>
              )}
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}

function frameSize(stdout: NodeJS.WriteStream) {
  // Leave room for Ink's final newline and avoid the terminal's wrap column.
  return { columns: Math.max(1, (stdout.columns || 80) - 1), rows: Math.max(1, (stdout.rows || 24) - 1) };
}

function clampOffset(offset: number, limit: number) {
  return Math.max(0, Math.min(limit, offset));
}

function isAuthenticationError(message: string | null): boolean {
  return Boolean(message && /\b(?:401 Unauthorized|(?:HTTP|status(?: code)?[: ]+)\s*401|(?:invalid|missing)[_ ](?:OpenAI )?API[_ ]key|authentication (?:required|failed)|missing (?:bearer authentication|authorization header)|not logged in|please (?:log|sign) in)\b/iu.test(message));
}

function unquote(value: string) {
  return /^(["'])(.*)\1$/u.exec(value)?.[2] ?? value;
}

function filterItems<T extends PickerItem>(items: T[], query: string): T[] {
  return items.map((item) => ({
    item,
    score: Math.min(matchScore(item.label, query), matchScore(item.id, query),
      matchScore(item.detail ?? "", query), matchScore(item.description ?? "", query),
      matchScore("aliases" in item ? String(item.aliases) : "", query)),
  })).filter(({ score }) => Number.isFinite(score)).sort((a, b) => a.score - b.score).map(({ item }) => item);
}
