# Dicode Core API

The Core is the single business entry point for the TUI and CLI. It never
touches the Codex process directly and never depends on a concrete UI.

## Lifecycle

```ts
import { createDicodeCore } from "@dicode/core";

const core = createDicodeCore({
  configDir: process.env.APPDATA + "\\Dicode\\config",
  dataDir: process.env.APPDATA + "\\Dicode\\data",
});

await core.initialize(); // ready
// ... use the API ...
await core.shutdown();   // stopped
```

## Project

```ts
const project = await core.openProject(process.cwd());
core.getCurrentProject();
core.listProjects();
```

## Sessions

```ts
const session = await core.createSession({ projectPath: project.path });
await core.resumeSession(session.id);
core.listSessions({ projectPath: project.path });
core.switchSession(session.id);
await core.archiveSession(session.id);
await core.deleteSession(session.id);
const forked = await core.forkSession(session.id);
core.renameSession(session.id, "New title");
```

A Dicode `Session` maps 1:1 to a Codex `Thread` via `codexThreadId`, but keeps
its own id, title, status, and product-level metadata.

## Tasks / messages

```ts
const task = await core.sendMessage(session.id, { text: "Analyze this project" });
await core.steerTask(session.id, { text: "Also list tests" });
await core.interruptTask(session.id);

core.getTask(task.id);
core.listTasksBySession(session.id);
core.getMessages(session.id);
core.getToolExecutions(session.id);
```

Task status: `queued -> running -> (waiting_approval) -> completed|failed|interrupted`.
One running task per session (a session-level lock rejects duplicate submission).

## Approvals

```ts
const pending = core.getPendingApprovals();
await core.respondApproval(pending[0].id, { kind: "approve" }); // or { kind: "deny" }
core.listApprovals(session.id);
```

The Core never auto-approves. Decisions are mapped to the protocol-specific
response shape by the underlying adapter.

## Events / state / config

```ts
const unsubscribe = core.subscribe((event) => {
  console.log(event.type, event.taskId, event.payload);
});

core.getState();        // Readonly<DicodeState>
core.getCapabilities(); // CoreCapabilities
core.getConfig();       // DicodeConfig
core.updateConfig({ agent: { defaultModel: "deepseek-v4-pro" } });
```

`CoreEvent` types are documented in `@dicode/core` `event-types.ts`. Events
carry `sessionId`, `taskId`, `turnId`, `itemId`, a per-session `sequence`, and a
monotonic `id`.

## Capabilities

`CoreCapabilities` reflects what the connected adapter can do. Unsupported
operations are reported as unavailable rather than failing silently.
