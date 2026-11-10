import { PassThrough } from "node:stream";
import { setImmediate } from "node:timers/promises";
import type { ApprovalInfo, DicodeCore } from "@dicode/core";
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

function frame(columns: number, rows: number, showToolDetails = false, scrollOffset = 0) {
  const stdout = Object.assign(new PassThrough(), { columns, rows }) as unknown as NodeJS.WriteStream;
  let captured = "";
  stdout.on("data", (chunk: Buffer) => { captured += chunk.toString(); });
  const app = render(createElement(Chat, { state, columns, rows, showToolDetails, scrollOffset }), {
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

function mountTerminal(view: ReactElement) {
  const stdout = Object.assign(new PassThrough(), { columns: 65, rows: 12 }) as unknown as NodeJS.WriteStream;
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
  return { app, stdin, latest: () => latest };
}

describe("terminal transcript", () => {
  it("keeps tools between the prompt and the answer and expands their output on request", () => {
    const summary = frame(104, 14);
    const expanded = frame(104, 14, true);
    expect(summary).toContain("Shell · npm test · 123 ms · exit 0");
    expect(summary).not.toContain("first test");
    expect(expanded).toContain("first test");
    expect(expanded.indexOf("You")).toBeLessThan(expanded.indexOf("npm test"));
    expect(expanded.indexOf("npm test")).toBeLessThan(expanded.indexOf("All tests passed."));
    expect(expanded).toContain("1 file · +1 −1");
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
      await vi.waitFor(() => expect(latest()).toContain("New session"));
      stdin.push("\u001b");
      await vi.waitFor(() => expect(latest()).toContain("PgDn Newer"));
    } finally {
      app.unmount();
    }
  });

  it("pastes a multiline draft, lazily creates the session on Enter, and preserves the draft when sending fails", async () => {
    const createSession = vi.fn().mockResolvedValue(session);
    const sendMessage = vi.fn()
      .mockRejectedValueOnce(new Error("Turn rejected"))
      .mockResolvedValueOnce(undefined);
    const { app, stdin, latest } = mountTerminal(createElement(App, { core: stubCore({ createSession, sendMessage }) }));
    const draft = /line one\s*\n[^\n]*line two/u;
    const prompt = { text: "line one\nline two", model: "test-model", mode: "default" };
    try {
      await vi.waitFor(() => expect(latest()).toContain("Ask Dicode about your project"));
      stdin.push("\u001b[200~line one\r\nline two\u001b[201~");
      await vi.waitFor(() => expect(latest()).toMatch(draft));
      expect(createSession).not.toHaveBeenCalled();
      expect(sendMessage).not.toHaveBeenCalled();

      stdin.push("\r");
      await vi.waitFor(() => expect(latest()).toContain("Turn rejected"));
      expect(latest()).toMatch(draft);
      expect(createSession).toHaveBeenCalledTimes(1);
      expect(sendMessage).toHaveBeenCalledTimes(1);
      expect(sendMessage).toHaveBeenCalledWith(session.id, expect.objectContaining(prompt));

      stdin.push("\r");
      await vi.waitFor(() => expect(latest()).toContain("Ask Dicode about your project"));
      expect(createSession).toHaveBeenCalledTimes(1);
      expect(sendMessage).toHaveBeenCalledTimes(2);
      expect(sendMessage).toHaveBeenLastCalledWith(session.id, expect.objectContaining(prompt));
    } finally {
      app.unmount();
    }
  });
});

describe("terminal approval", () => {
  it("ignores the approval shortcut inside bracketed paste and accepts a deliberate A", async () => {
    const approval: ApprovalInfo = {
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
    const onDecision = vi.fn().mockResolvedValue(undefined);
    const { app, stdin, latest } = mountTerminal(createElement(ApprovalModal, {
      approval,
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
});
