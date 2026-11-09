# Dicode Architecture

Dicode is a standalone Windows Code Agent CLI. It does **not** reimplement the
Codex agent runtime; instead it drives the official `codex.exe` through the
Codex App Server over JSON-RPC (stdio) and owns everything above that line:
CLI routing, TUI, session/task/event management, approvals, config, and storage.

## Layering

```text
Windows Terminal (PowerShell / CMD)
            |
            v
        dicode.exe                 packages/cli
            |
            v
        Dicode TUI                 packages/tui   (React + Ink)
            |
            v
      Application Core             packages/core
   +------------------+
   | Session Manager  | Event Manager | Approval Manager | Config | Storage
   +------------------+
            |
            v
       Codex Adapter               packages/codex-adapter
   +------------------+
   | Process Manager  | JSON-RPC Client | Event Mapper | Protocol registry
   +------------------+
            |
            v
     codex.exe app-server          runtime/codex (bundled)
            |
            v
       Codex Runtime
```

## Package responsibilities

| Package | Responsibility | Depends on |
| --- | --- | --- |
| `@dicode/shared` | Types, constants, JSON-RPC primitives, small utilities | - |
| `@dicode/codex-adapter` | `codex` process lifecycle, JSON-RPC transport, event mapping, approval routing | `shared` |
| `@dicode/core` | Session/task/event/approval/config/storage state machines | `shared`, `codex-adapter` |
| `@dicode/tui` | Terminal UI screens and components | `shared`, `core` |
| `@dicode/cli` | Argument parsing, router, entrypoint, subcommands | all of the above |

## Architectural invariants

1. **Codex Runtime is the agent core.** Dicode never implements reasoning.
2. **Dicode is a client.** Every agent operation goes through the App Server.
3. **JSON-RPC over stdio.** The protocol channel is newline-delimited JSON on
   stdout; stderr is captured to the log sink, never mixed into the channel.
4. **UI never calls `codex.exe` directly.** The TUI consumes `DicodeEvent`
   values produced by the adapter's event mapper.
5. **Core has no UI dependency.** The TUI can be replaced without touching core.
6. **No fabricated protocol.** Method names and payloads are constrained by the
   generated schema under `schemas/codex-app-server/`.
7. **No auto-approval of dangerous operations.** Approval prompts are surfaced
   to the user and only resolved with an explicit decision.
8. **No credentials in logs.** Token-bearing values are redacted.
9. **User data never lives in the install directory.** It is stored under
   `%APPDATA%\Dicode`.

## Data flow (a single turn)

```text
User types a prompt in the TUI
      -> core starts/continues a turn
      -> adapter issues turn/start (or thread/start + turn/start)
      -> App Server streams notifications (turn/started, item/started,
         item/agentMessage/delta, item/commandExecution/outputDelta, ...)
      -> adapter maps them to DicodeEvent values
      -> core updates session/task state and emits to the TUI
      -> approval requests (server -> client) pause the turn until the user
         responds via the adapter's respond() path
      -> turn/completed finalizes the turn
```

## Phase 1 status

- Environment validated (Windows 11, Node 24, Codex `0.167.0-alpha.3.2`).
- App Server protocol schema generated and mapped.
- JSON-RPC handshake (`initialize` -> `initialized` -> read-only methods)
  verified against a live App Server.
- Monorepo skeleton and module directories established.
