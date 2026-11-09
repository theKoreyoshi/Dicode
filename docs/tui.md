# Dicode TUI

The TUI is a React + Ink terminal interface that talks only to the Dicode Core.
It never calls the Codex Adapter directly.

## Stack

- Ink 5 (Yoga layout, ANSI rendering)
- React 18
- `@dicode/core` (the only business dependency)

## Layout

```text
┌ Header (brand / status / project / session / model) ─────────────┐
├ Sidebar (sessions, project) ┬ Chat (messages + streaming) ──────┤
├ Input ───────────────────────────────────────────────────────────┤
├ StatusBar (status + shortcuts) ──────────────────────────────────┤
└ Overlays: Approval modal, Command palette ───────────────────────┘
```

## Component map

| File | Responsibility |
| --- | --- |
| `app/App.tsx` | Root layout, `useInput` keyboard dispatch |
| `app/useDicodeApp.ts` | Core lifecycle, UI state, actions |
| `state/ui-store.ts` | Pure reducer (streaming merge, approvals, status) |
| `screens/Welcome.tsx` | Brand logo + quick start |
| `screens/Chat.tsx` | Sidebar + message list |
| `components/Header.tsx` / `StatusBar.tsx` | Chrome |
| `components/Message*.tsx` | User/assistant messages |
| `components/Input.tsx` | Multi-line input |
| `components/ApprovalModal.tsx` | Approval prompt |
| `components/CommandPalette.tsx` | Command palette |

## Keyboard

| Key | Action |
| --- | --- |
| Enter | Send message |
| Shift+Enter | Newline |
| Ctrl+C | Cancel running task |
| Ctrl+N | New session |
| Ctrl+P | Command palette |
| Ctrl+B | Toggle sidebar |
| Ctrl+Q | Quit |
| Esc | Close overlay |

## Startup

```powershell
npm run dev                          # dev: tsx packages/cli/src/index.ts
npx tsx packages/cli/src/index.ts --cwd "D:\Projects\Demo"
npx tsx packages/cli/src/index.ts --resume
npx tsx packages/cli/src/index.ts --help
```

`dicode` with no args starts the TUI, initializes Core (spawning the real
Codex App Server), opens the current directory as project, and shows the
Welcome screen. Production packaging (`dicode.exe`) is Phase 6.

## Verified behavior

A real smoke run (PowerShell, `--cwd` to this repository) produced the Welcome
screen with the DICODE logo, `Ready` status, the detected project path, and the
quick-start list — backed by a live `codex app-server` (`userAgent:
Codex Desktop/... dumb (Dicode; 0.1.0)`). The task/streaming path is exercised
by `npm run test:core`.
