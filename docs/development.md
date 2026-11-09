# Development

## Prerequisites

- Node.js 20+ (validated on v24.18.0)
- npm 11+
- Git
- Codex CLI (the App Server under test)

## Setup

```powershell
npm install
npm run typecheck
npm run lint
npm test
```

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run typecheck` | TypeScript type check (sandbox-safe) |
| `npm run lint` | ESLint |
| `npm test` | Unit tests (43) |
| `npm run test:codex` | Real App Server integration test |
| `npm run test:core` | Real Dicode Core integration test |
| `npm run verify:app-server` | Phase 1 raw handshake probe |

## Workspaces

The repository is an npm-workspaces monorepo. TypeScript path aliases map
`@dicode/*` package names to their `src/index.ts` for typecheck and tests; the
production build will emit per-package `dist/` and resolve via `exports`.

## Verifying the App Server

The probe requires write access to `%USERPROFILE%\.codex` because the App
Server creates temp files there. Run it outside the development sandbox:

```powershell
npm run verify:app-server
```

## Running tests in a sandboxed environment

`npm run typecheck` runs inside the sandbox, but `npm test` (Vitest) needs to
read the repository's parent directories during module resolution, which the
sandbox blocks. Run it with the host's full filesystem access (outside the
sandbox) when developing in the restricted environment:

```powershell
npm test
```

In a normal (non-sandboxed) development checkout neither command needs special
handling.

`npm run test:codex` always requires host filesystem/network access: it spawns
the real App Server, creates a thread, and sends a real task to the model
provider proxy.

## Codex Adapter

The adapter is the bottom communication layer. See
[docs/adapter-usage.md](adapter-usage.md) for a minimal usage example and
[docs/protocol.md](protocol.md) for the verified protocol.

The Core is the business layer above the adapter. See
[docs/core-api.md](core-api.md) for the facade API.

## Regenerating protocol artifacts

```powershell
codex app-server generate-json-schema --experimental --out schemas/codex-app-server
codex app-server generate-ts --experimental --out schemas/codex-app-server/generated-ts
```

Any change to the method registry in
`packages/codex-adapter/src/protocol.ts` is checked against these generated
schemas by `tests/unit/protocol.test.ts`.

## Phase plan

1. Environment + protocol verification (this phase).
2. Codex adapter (process manager, JSON-RPC client, handshake, threads, turns,
   events, approvals, abnormal-exit handling).
3. Core (session/task/event/approval/config/storage).
4. TUI (Welcome, Chat, Tool, Approval, Diff, Settings).
5. Feature parity (P0/P1).
6. Windows packaging (exe, runtime, MSI, PATH, uninstall, diagnostics).
7. Test and acceptance in a clean Windows VM.
