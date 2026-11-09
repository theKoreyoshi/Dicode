# Codex App Server Protocol

This document records the **verified** Codex App Server protocol used by
Dicode. It is based on the schema generated from the locally installed Codex
runtime, not on assumptions.

- Codex version: `0.167.0-alpha.3.2`
- Protocol generations: `v1` (initialize), `v2` (everything else)
- Transport: newline-delimited JSON-RPC over `stdio`
- Schema source: `schemas/codex-app-server/` (generated via
  `codex app-server generate-json-schema --experimental`)
- TypeScript bindings: `schemas/codex-app-server/generated-ts/`

## Transport

```powershell
codex app-server --listen stdio://
```

- `stdin`  -> client messages to the server.
- `stdout` -> server messages to the client (one JSON object per line).
- `stderr` -> human/log output only. **Do not** treat it as protocol data.

The server also supports `unix://`, `ws://IP:PORT`, and `off`, but Dicode uses
`stdio://`.

## Message envelope

The wire format is JSON-RPC 2.0 (`jsonrpc` is accepted but not required):

| Kind | Shape |
| --- | --- |
| Request | `{ id, method, params? }` |
| Notification | `{ method, params? }` |
| Response | `{ id, result }` |
| Error | `{ id, error: { code, message, data? } }` |

`id` is a string or integer. See `@dicode/shared` `jsonrpc.ts` for the parsed
types used internally.

## Handshake

```text
client -> initialize request        { clientInfo: { name, version }, capabilities? }
server -> initialize response       { userAgent, codexHome, platformFamily, platformOs }
client -> initialized notification  (no params)
```

Only after `initialized` may the client create/read threads and start turns.
This sequence is encoded in `@dicode/codex-adapter` `HANDSHAKE_STEPS`.

### Verified initialize response

```json
{
  "userAgent": "Codex Desktop/0.167.0-alpha.3.2 (Windows 10.0.26200; x86_64) dumb (dicode; 0.1.0)",
  "codexHome": "C:\\Users\\<user>\\.codex",
  "platformFamily": "windows",
  "platformOs": "windows"
}
```

## Client -> server methods

The full registry (170+ methods) lives in
`schemas/codex-app-server/ClientRequest.json`. The methods Dicode relies on are:

### Session / thread

| Method | Purpose |
| --- | --- |
| `thread/start` | Create a new thread (accepts `cwd`, `model`, `sandbox`, `approvalPolicy`, ...). |
| `thread/resume` | Reopen a persisted thread. |
| `thread/list` | List threads (filters: `cwd`, `archived`, `searchTerm`, ...). |
| `thread/read` | Read a thread's metadata. |
| `thread/fork` | Fork a thread. |
| `thread/archive` / `thread/unarchive` | Archive / restore. |
| `thread/delete` | Delete a thread. |
| `thread/revert` | Revert a thread to an earlier state. |
| `thread/turns/list` | List a thread's turns. |
| `thread/items/list` / `thread/items/read` | Read items. |
| `thread/timeline/list` | Read the turn timeline. |

### Turns

| Method | Purpose |
| --- | --- |
| `turn/start` | Start a turn on a thread with a prompt. |
| `turn/steer` | Append/steer an in-flight turn. |
| `turn/interrupt` | Interrupt an in-flight turn (`{ threadId, turnId }`). |
| `turn/settings/update` | Update turn settings. |

### Runtime / account / config

| Method | Purpose |
| --- | --- |
| `model/list` | List models (`{ data: [...] }`). |
| `account/read` | Read account/auth status (`{ account: { type } }`). |
| `config/read` | Read effective configuration. |
| `command/exec` | Run a command with a PTY (`{ threadId, command, ... }`). |
| `command/exec/write` / `resize` / `terminate` | Drive a running command. |
| `process/spawn` | Spawn a background process. |
| `process/writeStdin` / `kill` / `resizePty` | Drive a background process. |

## Server -> client methods

### Requests (require a response)

These are approval / elicitation prompts. Dicode must respond with a decision;
they are never treated as chat messages.

| Method | Meaning |
| --- | --- |
| `item/commandExecution/requestApproval` | Approve/deny a shell command. |
| `item/fileChange/requestApproval` | Approve/deny a file change. |
| `item/permissions/requestApproval` | Approve/deny a permission request. |
| `item/tool/requestUserInput` | Ask the user for tool input. |
| `mcpServer/elicitation/request` | MCP elicitation prompt. |
| `item/tool/call` | Dynamic tool call requiring client execution. |
| `currentTime/read` | Read the current time. |
| `applyPatchApproval` / `execCommandApproval` | Legacy approval aliases. |

### Notifications (event stream)

Key streaming events mapped to Dicode internal events:

| Method | Dicode event |
| --- | --- |
| `turn/started` / `turn/completed` | `turn.started` / `turn.completed` |
| `item/started` / `item/completed` | `item.started` / `item.completed` |
| `item/agentMessage/delta` | `agent.message.delta` |
| `item/commandExecution/outputDelta` | `shell.output` |
| `item/fileChange/outputDelta` / `item/fileChange/patchUpdated` | `file.changed` |
| `turn/diff/updated` | `diff.updated` |
| `item/reasoning/textDelta` / `summaryTextDelta` | reasoning stream |
| `thread/started` / `thread/status/changed` | session lifecycle |
| `error` | `agent.error` |

The full notification list is in
`schemas/codex-app-server/ServerNotification.json`.

## Approval flow

```text
Agent requests an operation
   -> server sends a server->client request (e.g. item/commandExecution/requestApproval)
   -> Dicode surfaces an approval UI
   -> user approves/denies
   -> Dicode responds with the decision
   -> agent continues or aborts
```

Dicode honors the server's sandbox/permission policy and never auto-approves.

## Phase 1 verification result

The following were executed against a live App Server and all succeeded:

```text
initialize       -> userAgent / codexHome / platform*
initialized      -> accepted
account/read     -> { account: { type: "apiKey" }, requiresOpenaiAuth: true }
model/list       -> deepseek-v4-flash, deepseek-v4-pro
thread/list      -> current thread metadata
config/read      -> effective configuration
```

The probe script is `tools/verify-app-server.mjs`.
