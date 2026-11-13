import { PassThrough } from "node:stream";
import { setImmediate } from "node:timers/promises";
import { stripVTControlCharacters } from "node:util";
import type { ApprovalInfo, CoreEvent, CustomModelConfig, DicodeCore } from "@dicode/core";
import { render } from "ink";
import { createElement, type ReactElement } from "react";
import stringWidth from "string-width";
import { describe, expect, it, vi } from "vitest";
import { App } from "../../../packages/tui/src/app/App.js";
import { ApprovalModal } from "../../../packages/tui/src/components/ApprovalModal.js";
import { Chat } from "../../../packages/tui/src/screens/Chat.js";
import { createInitialUiState, type UiState } from "../../../packages/tui/src/state/ui-store.js";

const state: UiState = {
  ...createInitialUiState(),
  projectName: "example",
  projectPath: "E:\\work\\example",
  sessionId: "example-session",
  messages: [
    { id: "user", role: "user", content: "请检查项目目录中的文件并解释模块的输入和输出行为。", streaming: false, timestamp: 1 },
    { id: "answer", role: "assistant", content: "## Summary\n\nAll tests passed.", streaming: false, timestamp: 3 },
  ],
  tools: [{
    id: "shell",
    type: "commandExecution",
    label: "npm test",
    status: "completed",
    timestamp: 2,
    output: "\u001b[32mfirst test\u001b[0m\nsecond test\nthird test",
    durationMs: 123,
    exitCode: 0,
  }],
  diff: "diff --git a/example.ts b/example.ts\n--- a/example.ts\n+++ b/example.ts\n@@ -1 +1 @@\n-old\n+new",
};

function frame(columns: number, rows: number, showToolDetails = false, scrollOffset = 0, view = state) {
  const stdout = Object.assign(new PassThrough(), { columns, rows }) as unknown as NodeJS.WriteStream;
  let captured = "";
  stdout.on("data", (chunk: Buffer) => { captured += chunk.toString(); });
  const app = render(createElement(Chat, { state: view, columns, rows, showToolDetails, scrollOffset }), {
    stdout,
    debug: true,
    patchConsole: false,
  });
  try {
    return captured;
  } finally {
    app.unmount();
  }
}

const project = { path: state.projectPath, name: state.projectName };
const session = { id: "saved", title: "Saved session", projectPath: project.path, model: "test-model" };

function stubCore(overrides: Record<string, unknown> = {}): DicodeCore {
  return {
    initialize: async () => {},
    shutdown: async () => {},
    openProject: () => project,
    getCurrentProject: () => project,
    getStatus: () => "ready",
    listSessions: () => [session],
    listModels: async () => [],
    getSession: () => session,
    resumeSession: async () => session,
    getConfig: () => ({ agent: {}, runtime: {} }),
    subscribe: () => () => {},
    getState: () => ({ tasks: { runningBySession: {} } }),
    getMessages: () => [],
    getToolExecutions: () => [],
    getLatestSessionEvent: () => undefined,
    ...overrides,
  } as unknown as DicodeCore;
}

function mountTerminal(view: ReactElement, rows = 12) {
  const stdout = Object.assign(new PassThrough(), { columns: 65, rows }) as unknown as NodeJS.WriteStream;
  const stdin = Object.assign(new PassThrough(), {
    isTTY: true,
    setRawMode: () => {},
    ref: () => {},
    unref: () => {},
  }) as unknown as NodeJS.ReadStream;
  let latest = "";
  stdout.on("data", (chunk: Buffer) => { latest = chunk.toString(); });
  const app = render(view, {
    stdin,
    stdout,
    debug: true,
    patchConsole: false,
    exitOnCtrlC: false,
  });
  const resize = (nextRows: number) => {
    Object.assign(stdout, { rows: nextRows });
    stdout.emit("resize");
  };
  return { app, stdin, latest: () => latest, resize };
}

describe("terminal transcript", () => {
  it("keeps tools between the prompt and the answer and expands their output on request", () => {
    const summary = frame(150, 22);
    const expanded = frame(150, 22, true);
    expect(summary).toContain("1 command");
    expect(summary).not.toContain("3 output lines");
    expect(summary).not.toContain("first test");
    expect(summary).not.toContain("npm test");
    expect(stripVTControlCharacters(summary)).toContain("┃ 请检查项目目录中的文件并解释模块的输入和输出行为。");
    expect(expanded).toContain("$ npm test · 123 ms · exit 0");
    expect(expanded).toContain("first test");
    expect(expanded.indexOf("You")).toBeLessThan(expanded.indexOf("npm test"));
    expect(expanded.indexOf("npm test")).toBeLessThan(expanded.indexOf("All tests passed."));
    expect(expanded).toContain("1 file · +1 −1");
  });

  it("collapses consecutive calls from one turn into a muted inline summary", () => {
    const view: UiState = {
      ...state,
      tools: [
        { ...state.tools[0]!, id: "read", turnId: "turn-1", type: "fileRead", label: "package.json", timestamp: 2 },
        { ...state.tools[0]!, id: "test", turnId: "turn-1", label: "npm test", timestamp: 2.5 },
      ],
    };
    const summary = frame(80, 16, false, 0, view);
    const expanded = frame(80, 16, true, 0, view);
    expect(summary).toContain("1 read, 1 command");
    expect(summary).not.toContain("Activity · 2 steps");
    expect(summary).not.toContain("package.json");
    expect(summary).not.toContain("first test");
    expect(expanded).toContain("package.json");
    expect(expanded).toContain("npm test");
    expect(expanded).toContain("first test");
  });

  it("shows each streamed assistant phase in the default transcript", () => {
    const view: UiState = {
      ...state,
      status: "running",
      currentTaskId: "current",
      messages: [
        { ...state.messages[0], taskId: "current" },
        { id: "comment", role: "assistant", phase: "commentary", content: "A running commentary", streaming: false, timestamp: 2, taskId: "current" },
        { id: "partial", role: "assistant", phase: "partial_answer", content: "An intermediate answer", streaming: false, timestamp: 3, taskId: "current" },
        { id: "untyped", role: "assistant", content: "Unclassified draft", streaming: false, timestamp: 4, taskId: "current" },
        { id: "final", role: "assistant", phase: "final_answer", content: "The final answer", streaming: false, timestamp: 5, taskId: "current" },
      ],
    };
    const compact = frame(104, 20, false, 0, view);
    expect(compact).toContain("1 command");
    expect(compact).toContain("A running commentary");
    expect(compact).toContain("An intermediate answer");
    expect(compact).toContain("Unclassified draft");
    expect(compact).toContain("The final answer");
    expect(compact).not.toContain("first test");
    const expanded = frame(104, 20, true, 0, view);
    expect(expanded).toContain("A running commentary");
    expect(expanded).toContain("An intermediate answer");
    expect(expanded).toContain("Unclassified draft");
    expect(expanded).toContain("first test");
  });

  it("keeps all messages and shortens verbose tool labels", () => {
    const view: UiState = {
      ...state,
      status: "ready",
      sidebarVisible: false,
      messages: [
        { ...state.messages[0], content: "First prompt" },
        { id: "older-draft", role: "assistant", content: "Old draft", streaming: false, timestamp: 2 },
        { id: "older-answer", role: "assistant", content: "Old answer", streaming: false, timestamp: 3 },
        { ...state.messages[0], id: "prompt2", content: "Second prompt", timestamp: 4 },
        { id: "recent-answer", role: "assistant", content: "Recent answer", streaming: false, timestamp: 7 },
        { id: "unfinished", role: "assistant", content: "Unfinished output", incomplete: true, streaming: false, timestamp: 8 },
      ],
      tools: [{ ...state.tools[0], timestamp: 5, label: "npm test " + "long argument ".repeat(35) }],
    };
    const summary = frame(42, 22, false, 0, view);
    expect(summary).toContain("Old draft");
    expect(summary).toContain("Old answer");
    expect(summary).toContain("Recent answer");
    expect(summary).not.toMatch(/first test/u);
    expect(summary).toContain("Unfinished output");
    expect(summary).toContain("1 command");
    expect(summary).not.toContain("long argument");
  });

  it("shows the latest or oldest rows in a narrow terminal without overflowing", () => {
    const latest = frame(38, 6, true);
    const oldest = frame(38, 6, true, 1000);
    expect(latest).toContain("All tests passed.");
    expect(oldest).toContain("Start of conversation");
    expect(oldest).toContain("请检查项目");
    expect(oldest).not.toContain("Activity");
    for (const output of [latest, oldest]) {
      const rows = output.split("\n");
      expect(rows.length).toBeLessThanOrEqual(6);
      expect(rows.every((line) => stringWidth(line) <= 38)).toBe(true);
    }
  });

  it("pages through a resumed session immediately and returns from the command palette", async () => {
    const messages = Array.from({ length: 24 }, (_, index) => ({
      id: `saved-${index}`,
      role: index % 2 ? "assistant" : "user",
      content: `Saved message ${index}`,
      createdAt: index + 1,
    }));
    const { app, stdin, latest } = mountTerminal(createElement(App, {
      core: stubCore({ getMessages: () => messages }),
      resume: true,
    }));
    try {
      await vi.waitFor(() => expect(latest()).toContain("Saved message 23"));
      stdin.push("\u001b[5~");
      await vi.waitFor(() => expect(latest()).toContain("PgDn Newer"));
      expect(latest()).not.toContain("Saved message 23");

      stdin.push("\u0010");
      await vi.waitFor(() => expect(latest()).toContain("Type to search"));
      const panel = latest().split("\n").filter((row) => /│.*│/u.test(row));
      expect(panel.length).toBeGreaterThan(0);
      expect(panel.join("\n")).not.toContain("Saved message");
      stdin.push("\u001b");
      await vi.waitFor(() => expect(latest()).toContain("PgDn Newer"));
    } finally {
      app.unmount();
    }
  });

  it("shows slash commands above the shared home composer in two columns", async () => {
    const { app, stdin, latest } = mountTerminal(createElement(App, { core: stubCore() }), 20);
    try {
      await vi.waitFor(() => expect(latest()).toContain("Ask anything"));
      const promptRow = latest().split("\n").findIndex((row) => row.includes("Ask anything"));
      stdin.push("/");
      await vi.waitFor(() => expect(latest()).toContain("Choose Build or Plan"));
      const output = latest();
      expect(output).toContain("/agents");
      expect(output.indexOf("/agents")).toBeLessThan(output.indexOf("┃ /"));
      expect(output.split("\n").findIndex((row) => row.includes("┃ /"))).toBe(promptRow);
      const suggestions = output.split("\n").slice(0, promptRow).filter((row) => /\s\/\w/u.test(row));
      expect(suggestions.every((row) => !row.includes("█"))).toBe(true);
      expect(output).not.toContain("Commands");
      expect(output).toContain("tab agents · ctrl+p commands");
    } finally {
      app.unmount();
    }
  });

  it("covers the transcript behind slash suggestions and restores it without moving the composer", async () => {
    const messages = Array.from({ length: 15 }, (_, index) => ({
      id: `covered-${index}`, role: "assistant", content: `Background transcript ${index}`, createdAt: index + 1,
    }));
    const { app, stdin, latest } = mountTerminal(createElement(App, {
      core: stubCore({ getMessages: () => messages }), resume: true,
    }), 20);
    try {
      await vi.waitFor(() => expect(latest()).toContain("Background transcript 14"));
      const promptRow = latest().split("\n").findIndex((row) => row.includes("Ask anything"));
      stdin.push("/");
      await vi.waitFor(() => expect(latest()).toContain("Choose Build or Plan"));
      const rows = latest().split("\n");
      expect(rows.findIndex((row) => row.includes("┃ /"))).toBe(promptRow);
      expect(rows.filter((row) => /^\s*\/\w/u.test(row)).join("\n")).not.toContain("Background transcript");
      expect(latest()).not.toContain("Background transcript 14");
      stdin.push("\u001b");
      await vi.waitFor(() => expect(latest()).toContain("Background transcript 14"));
      expect(latest()).not.toContain("Choose Build or Plan");
    } finally {
      app.unmount();
    }
  });

  it("offers the high-risk allow-all permission mode from slash commands", async () => {
    const updateConfig = vi.fn();
    const core = stubCore({
      getConfig: () => ({ agent: { permissionMode: "default" }, runtime: {} }),
      updateConfig,
    });
    const { app, stdin, latest } = mountTerminal(createElement(App, { core }), 20);
    try {
      await vi.waitFor(() => expect(latest()).toContain("Ask anything"));
      stdin.push("/permissions");
      await vi.waitFor(() => expect(latest()).toContain("/permissions"));
      stdin.push("\r");
      await vi.waitFor(() => expect(latest()).toContain("Allow all"));
      expect(latest()).toContain("HIGH RISK");
      stdin.push("\u001b[B");
      stdin.push("\r");
      await vi.waitFor(() => expect(updateConfig).toHaveBeenCalledWith({ agent: { permissionMode: "full" } }));
      expect(latest()).toContain("HIGH RISK");
    } finally {
      app.unmount();
    }
  });

  it("scrolls a resumed transcript with the wheel while preserving the draft and arrow-key history", async () => {
    const messages = Array.from({ length: 24 }, (_, index) => ({
      id: `wheel-${index}`,
      role: index % 2 ? "assistant" : "user",
      content: `Saved message ${index}`,
      createdAt: index + 1,
    }));
    const { app, stdin, latest } = mountTerminal(createElement(App, {
      core: stubCore({ getMessages: () => messages }),
      resume: true,
    }));
    try {
      await vi.waitFor(() => expect(latest()).toContain("Saved message 23"));
      stdin.push("keep this draft");
      await vi.waitFor(() => expect(latest()).toContain("keep this draft"));

      stdin.push("\u001b[<64;15;10M");
      await vi.waitFor(() => expect(latest()).toContain("PgDn Newer"));
      expect(latest()).toContain("keep this draft");
      expect(latest()).not.toContain("Saved message 23");

      stdin.push("\u001b[<65;15;10M");
      await vi.waitFor(() => expect(latest()).toContain("Saved message 23"));
      expect(latest()).toContain("keep this draft");

      stdin.push("\u001b[A");
      await vi.waitFor(() => expect(latest()).toContain("Saved message 22"));
      stdin.push("\u001b[B");
      await vi.waitFor(() => expect(latest()).toContain("keep this draft"));
    } finally {
      app.unmount();
    }
  });

  it("restores the start of the settings panel when the terminal grows to fit it", async () => {
    const { app, stdin, latest, resize } = mountTerminal(createElement(App, { core: stubCore() }), 9);
    try {
      await vi.waitFor(() => expect(latest()).toContain("Ask anything"));
      stdin.push("/status");
      await vi.waitFor(() => expect(latest()).toContain("/status"));
      stdin.push("\r");
      await vi.waitFor(() => expect(latest()).toContain("Connection"));
      stdin.push("\u001b[<65;15;5M");
      await vi.waitFor(() => expect(latest()).not.toContain("Connection"));
      expect(latest()).toContain("Auto-detected");
      expect(latest()).toContain("M configure model");

      resize(19);
      await vi.waitFor(() => expect(latest()).toContain("Connection"));
      expect(latest()).toContain("Project");
      expect(latest()).toContain("Auto-detected");
    } finally {
      app.unmount();
    }
  });

  it("edits and saves a custom model from the command palette without submitting the current draft", async () => {
    let customModel: CustomModelConfig | null = null;
    const saveCustomModel = vi.fn((model: CustomModelConfig | null) => {
      if (model && !model.model) throw new Error("Enter a model ID.");
      customModel = model;
      return model;
    });
    const sendMessage = vi.fn();
    const { app, stdin, latest } = mountTerminal(createElement(App, {
      core: stubCore({ getConfig: () => ({ agent: { customModel }, runtime: {} }), saveCustomModel, sendMessage }),
    }), 18);
    const openEditor = async () => {
      stdin.push("\u0010");
      await vi.waitFor(() => expect(latest()).toContain("Type to search"));
      stdin.push("model-config");
      await vi.waitFor(() => expect(latest()).toContain("Search  model-config"));
      expect(latest()).toContain("/model-config");
      stdin.push("\r");
      await vi.waitFor(() => expect(latest()).toContain("Model configuration"));
    };
    try {
      await vi.waitFor(() => expect(latest()).toContain("Ask anything"));
      stdin.push("draft to keep");
      await vi.waitFor(() => expect(latest()).toContain("draft to keep"));
      await openEditor();
      stdin.push("\u001b[A");
      await vi.waitFor(() => expect(latest()).toContain("› Save and use"));
      stdin.push("\r");
      await vi.waitFor(() => expect(latest()).toContain("Enter a model ID."));
      stdin.push("\t");
      await vi.waitFor(() => expect(latest()).toContain("› Model ID"));
      stdin.push("gateway-model");
      await vi.waitFor(() => expect(latest()).toContain("gateway-model"));
      stdin.push("\t");
      await vi.waitFor(() => expect(latest()).toContain("› Base URL"));
      stdin.push("https://test.gateway.example/v1");
      await vi.waitFor(() => expect(latest()).toContain("https://test.gateway.example/v1"));
      stdin.push("\t");
      await vi.waitFor(() => expect(latest()).toContain("› Key variable"));
      stdin.push("DICODE_TEST_MODEL_KEY");
      await vi.waitFor(() => expect(latest()).toContain("DICODE_TEST_MODEL_KEY"));
      stdin.push("\t");
      await vi.waitFor(() => expect(latest()).toContain("› Save and use"));
      stdin.push("\r");
      await vi.waitFor(() => expect(saveCustomModel).toHaveBeenCalledTimes(2));
      expect(saveCustomModel).toHaveBeenLastCalledWith({
        model: "gateway-model", baseUrl: "https://test.gateway.example/v1", apiKeyEnv: "DICODE_TEST_MODEL_KEY",
      });
      expect(latest()).toContain("gateway-model");
      expect(sendMessage).not.toHaveBeenCalled();

      await openEditor();
      stdin.push("\u001b[A");
      await vi.waitFor(() => expect(latest()).toContain("› Use Codex defaults"));
      stdin.push("\r");
      await vi.waitFor(() => expect(latest()).toContain("draft to keep"));
      expect(saveCustomModel).toHaveBeenLastCalledWith(null);
      expect(latest()).not.toContain("gateway-model");
    } finally {
      app.unmount();
    }
  });

  it("pastes a multiline draft, lazily creates the session on Enter, and preserves the draft when sending fails", async () => {
    const createSession = vi.fn().mockResolvedValue(session);
    const sendMessage = vi.fn()
      .mockRejectedValueOnce(new Error("Unexpected status 401 Unauthorized"))
      .mockResolvedValueOnce(undefined);
    const { app, stdin, latest } = mountTerminal(createElement(App, { core: stubCore({ createSession, sendMessage }) }));
    const draft = /line one[^\n]*\n[^\n]*line two/u;
    const prompt = { text: "line one\nline two", model: "test-model", mode: "default" };
    try {
      await vi.waitFor(() => expect(latest()).toContain("Ask anything"));
      stdin.push("\u001b[200~line one\r\nline two\u001b[201~");
      await vi.waitFor(() => expect(latest()).toMatch(draft));
      expect(createSession).not.toHaveBeenCalled();
      expect(sendMessage).not.toHaveBeenCalled();

      stdin.push("\r");
      await vi.waitFor(() => expect(latest()).toContain("dicode login"));
      expect(latest()).toMatch(draft);
      expect(createSession).toHaveBeenCalledTimes(1);
      expect(sendMessage).toHaveBeenCalledTimes(1);
      expect(sendMessage).toHaveBeenCalledWith(session.id, expect.objectContaining(prompt));

      stdin.push("\r");
      await vi.waitFor(() => expect(latest()).toContain("Ask anything"));
      expect(createSession).toHaveBeenCalledTimes(1);
      expect(sendMessage).toHaveBeenCalledTimes(2);
      expect(sendMessage).toHaveBeenLastCalledWith(session.id, expect.objectContaining(prompt));
    } finally {
      app.unmount();
    }
  });

  it("sends inline /plan input using native Plan mode and displays plan event progress", async () => {
    const listeners: Array<(event: CoreEvent) => void> = [];
    const sendMessage = vi.fn().mockResolvedValue(undefined);
    const core = stubCore({
      createSession: async () => session,
      sendMessage,
      subscribe: (listener: (event: CoreEvent) => void) => { listeners.push(listener); return () => {}; },
    });
    const { app, stdin, latest } = mountTerminal(createElement(App, { core }));
    try {
      await vi.waitFor(() => expect(latest()).toContain("Ask anything"));
      stdin.push("/plan Prepare release");
      await vi.waitFor(() => expect(latest()).toContain("/plan Prepare release"));
      stdin.push("\r");
      await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledWith(session.id, expect.objectContaining({
        text: "Prepare release", mode: "plan",
      })));
      listeners[0]?.({
        id: "plan-event", type: "plan.updated", sessionId: session.id,
        turnId: "turn", sequence: 1, timestamp: 1,
        payload: { turnId: "turn", plan: [
          { step: "Read release notes", status: "completed" },
          { step: "Write rollout plan", status: "inProgress" },
        ] },
      });
      await vi.waitFor(() => expect(latest()).toContain("Plan · 1/2 complete"));
      expect(latest()).toContain("◌ Write rollout plan");
      listeners[0]?.({
        id: "plan-started", type: "message.started", sessionId: session.id,
        turnId: "turn", itemId: "proposed-plan", sequence: 2, timestamp: 2,
        payload: { item: { type: "plan", text: "" } },
      });
      listeners[0]?.({
        id: "plan-delta", type: "message.delta", sessionId: session.id,
        turnId: "turn", itemId: "proposed-plan", sequence: 3, timestamp: 3,
        payload: { delta: "Draft proposal" },
      });
      await vi.waitFor(() => expect(latest()).toContain("Draft proposal"));
      listeners[0]?.({
        id: "plan-completed", type: "message.completed", sessionId: session.id,
        turnId: "turn", itemId: "proposed-plan", sequence: 4, timestamp: 4,
        payload: { item: { type: "plan", text: "Authoritative rollout plan" } },
      });
      await vi.waitFor(() => expect(latest()).toContain("Authoritative rollout plan"));
      expect(latest()).not.toContain("Draft proposal");
    } finally {
      app.unmount();
    }
  });

  it("shows runtime diagnostics when App Server startup fails", async () => {
    const core = stubCore({ initialize: async () => { throw new Error("Could not locate codex.exe"); } });
    const { app, latest } = mountTerminal(createElement(App, { core }));
    try {
      await vi.waitFor(() => expect(latest()).toContain("Dicode could not start"));
      expect(latest()).toContain("Could not locate codex.exe");
      expect(latest()).toContain("dicode doctor");
    } finally {
      app.unmount();
    }
  });
});

const commandApproval: ApprovalInfo = {
  id: "approval",
  sessionId: session.id,
  taskId: "task",
  codexRequestId: "1",
  type: "command",
  title: "Approve shell command",
  description: null,
  status: "pending",
  metadata: { params: { command: "npm test" } },
  createdAt: 1,
  resolvedAt: null,
};

describe("terminal approval", () => {
  it("ignores the approval shortcut inside bracketed paste and accepts a deliberate A", async () => {
    const onDecision = vi.fn().mockResolvedValue(undefined);
    const { app, stdin, latest } = mountTerminal(createElement(ApprovalModal, {
      approval: commandApproval,
      columns: 65,
      rows: 12,
      onDecision,
    }));
    try {
      await vi.waitFor(() => expect(latest()).toContain("Allow once"));
      // Use separate reads so the middle input is indistinguishable from a typed shortcut without paste state.
      for (const chunk of ["\u001b[200~", "a", "\u001b[201~"]) {
        stdin.push(chunk);
        await setImmediate();
      }
      expect(onDecision).not.toHaveBeenCalled();

      stdin.push("A");
      await vi.waitFor(() => expect(onDecision).toHaveBeenCalledWith({ kind: "approve" }));
      expect(onDecision).toHaveBeenCalledTimes(1);
    } finally {
      app.unmount();
    }
  });

  it("identifies a managed-network request and submits only the offered approval scope", async () => {
    const onDecision = vi.fn().mockResolvedValue(undefined);
    const approval = {
      ...commandApproval,
      metadata: { params: {
        command: "internal network request",
        networkApprovalContext: { host: "example.com:443", protocol: "https" },
        availableDecisions: ["acceptForSession", "cancel"],
      } },
    };
    const { app, stdin, latest } = mountTerminal(createElement(ApprovalModal, {
      approval, columns: 65, rows: 12, onDecision,
    }));
    try {
      await vi.waitFor(() => expect(latest()).toContain("Approve network access"));
      expect(latest()).toContain("HTTPS example.com:443");
      expect(latest()).toContain("Cancel request");
      expect(latest()).not.toContain("Allow once");
      expect(latest()).not.toContain("internal network request");
      stdin.push("A");
      await setImmediate();
      expect(onDecision).not.toHaveBeenCalled();
      stdin.push("\u001b[B");
      await vi.waitFor(() => expect(latest()).toContain("Allow this host fo"));
      stdin.push("\r");
      await vi.waitFor(() => expect(onDecision).toHaveBeenCalledWith({
        kind: "custom", result: { decision: "acceptForSession" },
      }));
      expect(onDecision).toHaveBeenCalledTimes(1);
    } finally {
      app.unmount();
    }
  });
});
