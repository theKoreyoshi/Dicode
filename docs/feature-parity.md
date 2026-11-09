# Feature Parity

Targets map Dicode's P0/P1/P2 goals to the capabilities the App Server
actually provides. This table is updated as each phase lands.

Legend: `App Server` = native protocol support, `Adapter` / `Core` / `UI` =
implemented in Dicode, `Test` = covered by an automated test.

## P0 — core

| Capability | App Server | Adapter | Core | UI | Test |
| --- | --- | --- | --- | --- | --- |
| Launch Dicode TUI | n/a | - | - | pending | - |
| New session | `thread/start` | pending | pending | pending | - |
| Multi-turn chat | `turn/start` | pending | pending | pending | - |
| Streaming output | `item/agentMessage/delta` | pending | pending | pending | - |
| Resume session | `thread/resume` | pending | pending | pending | - |
| History sessions | `thread/list` | pending | pending | pending | - |
| Steer (append) | `turn/steer` | pending | pending | pending | - |
| Interrupt | `turn/interrupt` | pending | pending | pending | - |
| Tool calls | `item/started` + payloads | pending | pending | pending | - |
| Shell execution | `command/exec` / item output | pending | pending | pending | - |
| File read/modify | fs + file change events | pending | pending | pending | - |
| Approvals | server->client requests | pending | pending | pending | - |
| Diff view | `turn/diff/updated` | pending | pending | pending | - |
| Markdown/code highlight | n/a | - | - | pending | - |
| Project dir | `thread/start.cwd` | pending | pending | pending | - |
| Error handling | `error` + exit detection | pending | pending | pending | - |

## P1 — advanced

| Capability | App Server | Notes |
| --- | --- | --- |
| Model switch | `model/list` + `thread/start.model` | verified |
| Reasoning effort | turn settings | schema present |
| MCP management | `mcpServer/*`, `mcpServerStatus/*` | schema present |
| Skills | `skills/list`, `skills/config/write` | schema present |
| Plan mode | `turn/plan/updated` | notification present |
| Git status | n/a (fs + shell) | not a native method |
| Code review | `review/start` | schema present |
| Fork | `thread/fork` | verified in schema |
| Archive | `thread/archive` | verified in schema |
| Context management | `thread/compact/start` | schema present |
| Multi-session switch | `thread/list` | verified |
| Config management | `config/read` / `config/value/write` | verified read |
| Command palette | n/a | UI-only |

## P2 — extended

| Capability | App Server | Notes |
| --- | --- | --- |
| Multi-agent | `multiAgentMode` (deprecated) / ultra effort | review before use |
| Sub-agent status | `item/started` with subagent items | schema present |
| Parallel tasks | `process/spawn` / queue methods | schema present |
| Plugins | `plugin/*`, `marketplace/*` | schema present |

## Known limitations

1. `account/read` returns `{ type: "apiKey" }` for the current custom-provider
   setup; full account/profile surfaces depend on auth mode.
2. `multiAgentMode` is marked deprecated in the schema; use ultra reasoning
   effort for proactive multi-agent behavior.
3. `model/list` is the confirmed method name; there is no `account/list` alias.
