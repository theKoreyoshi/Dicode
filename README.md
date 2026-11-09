# Dicode

**AI Coding Agent for Developers**

Dicode is an enterprise-grade Windows Code Agent CLI with its own brand, terminal
UI, session management, and complete agent interaction model. It uses the official
Codex CLI (`codex.exe`) as the underlying agent engine and communicates with it
exclusively through the Codex App Server over JSON-RPC (stdio).

> Status: Phase 1 (environment validation, protocol verification, monorepo
> skeleton). The TUI and adapter implementation land in later phases.

## Repository layout

```text
packages/
  cli/            CLI entry, router, and subcommands
  tui/            React/Ink terminal user interface
  core/           session/task/event/approval/config/storage
  codex-adapter/  process management + JSON-RPC client + event mapping
  shared/         shared types, constants, and utilities
schemas/
  codex-app-server/  generated protocol JSON Schema + TypeScript bindings
runtime/
  codex/             bundled Codex runtime (deployed during packaging)
installer/
  wix/               WiX Toolset packaging sources
tests/
  unit/ integration/ e2e/
docs/
  architecture.md protocol.md feature-parity.md installation.md development.md
tools/
  verify-app-server.mjs  Phase 1 JSON-RPC handshake probe
```

## Development

```powershell
npm install
npm run typecheck
npm test
```

## Verified environment

- Windows 11 x64 (PowerShell 7.6.9)
- Node.js v24.18.0, npm 11.16.0, Git 2.55.0
- Codex CLI `0.167.0-alpha.3.2`

See [docs/protocol.md](docs/protocol.md) for the verified App Server protocol and
[docs/architecture.md](docs/architecture.md) for the architecture.
