# Test Report

## Final source review · 2026-11-10

TypeScript, ESLint, 150 unit tests, and Inno Setup source validation passed.
The regression tests cover resizing a scrolled settings panel, upgrading an
existing database with interrupted replies, cancelling a pending browser login,
and redacting credentials in adapter diagnostics. All six Core integration
tests against Codex 0.167.0 passed, including streaming and resuming a session
after restart.

## Terminal layout, concise transcript, and mouse scrolling · 2026-11-10

| Check | Result |
| --- | --- |
| TypeScript, ESLint, Vitest | Passed. 146 unit tests across 26 files |
| Codex 0.167.0 | Six Adapter and six Core integration tests passed against the bundled runtime |
| Screen lifecycle | The updated `release/dicode.exe` entered and left the alternate screen once each. No adapter JSON or late frames appeared after exit |
| Layout and resize | Windows ConPTY showed the bordered prompt and separate settings row. A 100×26 → 34×8 → 100×26 resize preserved command palette and exit behavior |
| Concise transcript | Automated checks cover tool summaries, hidden intermediate output, authoritative final items and restored message phases from older SQLite sessions |
| Packaged task and resume | The bundled runtime edited a disposable project, displayed completed file and shell summaries and the final answer, listed the change in `/diff`, and restored the transcript after restart |
| Packaged mouse scrolling | A Windows ConPTY run checked visible transcript rows while scrolling over the output and prompt. Wheel events respected both bounds, preserved the draft, and still worked after resize. Keyboard arrows recalled input history, and Ctrl+Q restored terminal mouse mode |

## Bundled Codex 0.167.0 for Windows x64 · 2026-11-10

| Check | Result |
| --- | --- |
| TypeScript, ESLint, Vitest | Passed. 133 unit tests across 24 files |
| Adapter and Core integration | 6 Adapter and 6 Core tests passed against the official 0.167.0 App Server |
| Official App Server | Verified initialize, model, account, thread and config requests against the packaged release runtime |
| Runtime archive and staged files | Verified the upstream archive SHA-256 and all seven coding runtime files. The installer and ZIP carry the pinned manifest, licenses and NOTICE |
| Windows Setup | Installed to a temporary path with Chinese characters and spaces. The installed CLI verified the bundled runtime with a Windows-only PATH and invalid external Codex overrides. Uninstall removed the program and its PATH entry |
| Portable CLI | Extracted the ZIP and used its bundled runtime for streaming, an actual file edit and `/diff`, Ctrl+C, and restart/resume |
| First run | With isolated account data, diagnostics reported sign-in required. The packaged `dicode login` started browser OAuth, and Ctrl+C cancelled it. The packaged config, MCP and skills list commands returned App Server results |
| Codex Plan and approval | Observed native plan progress and the final plan item. A live command approval test confirmed the server's resolution after denial. A separate live interrupt removed a pending approval |

The Windows checks used this Windows 11 x64 host and isolated data directories.
A separate clean VM and the user's completion of browser sign-in remain
release acceptance checks.

## OpenCode-style TUI and Windows build · 2026-11-10

| Check | Result |
| --- | --- |
| TypeScript and ESLint | Passed |
| Vitest | 121 passed across 24 files |
| Codex Adapter against official Codex 0.167.0 | 6 passed |
| Core against official Codex 0.167.0 | 6 passed |
| Packaged CLI in Windows ConPTY | Interactive session startup, live output, Unicode and multiline input, file completion, command and session pickers, agent selection, resize, Ctrl+C immediately after turn startup, exit, and resume |
| File edit and turn diff | The packaged CLI created the expected fixture in a disposable Git repository and showed the new file in `/diff` with the complete Codex Desktop runtime |
| Real approval protocol | A temporary thread with the complete runtime requested command approval. The test declined the request and the turn completed |
| Windows x64 build | Node SEA and Inno Setup builds passed. Portable extraction and external-runtime diagnostics passed |

The isolated terminal tests cover first submission, retry after an error,
transcript pagination, and explicit approval input. The live approval check
exercised the App Server request/response separately from the TUI modal.
The file edit and approval used Codex Desktop Runtime `0.166.0-alpha.6`;
handshake and integration tests used the official `0.167.0` binary.
Installation and uninstall on a clean Windows VM remain a release check.

## Historical report · Phases 2–3

Generated 2026-11-09. Codex Runtime `0.167.0-alpha.3.2`.

## Summary

| Suite | Command | Result |
| --- | --- | --- |
| Type check | `npm run typecheck` | PASS |
| Lint | `npm run lint` | PASS |
| Unit tests | `npm test` | 43/43 PASS |
| Real integration | `npm run test:codex` | 6/6 PASS |
| Core unit tests | `npm test` | 62/62 PASS |
| Core real integration | `npm run test:core` | 6/6 PASS |
| TUI unit tests | `npm test` | 82/82 PASS |
| Phase 5 unit tests | `npm test` | 90/90 PASS |

## Unit tests (62)

| Module | Coverage | File |
| --- | --- | --- |
| JSON-RPC primitives | request/notification/response/error framing | `tests/unit/shared.test.ts` |
| Protocol registry vs generated schema | method-name consistency | `tests/unit/protocol.test.ts` |
| LineFramer | chunk reassembly, multi-line, limits, reset | `tests/unit/adapter/message-parser.test.ts` |
| RequestManager | resolve/reject/timeout/fail-all/duplicate | `tests/unit/adapter/request-manager.test.ts` |
| JsonRpcClient | correlation, errors, notifications, server requests | `tests/unit/adapter/jsonrpc-client.test.ts` |
| Event mapper | turn/item/tool/shell/file/unknown mapping | `tests/unit/adapter/event-mapper.test.ts` |
| Thread/Turn/Approval managers | protocol mapping + state tracking | `tests/unit/adapter/managers.test.ts` |
| ConfigManager | defaults, merge, validation, corrupt recovery | `tests/unit/core/config.test.ts` |
| Storage (SQLite) | migrations, session/task/message CRUD | `tests/unit/core/storage.test.ts` |
| StateManager | update/subscribe/select + subscriber isolation | `tests/unit/core/state.test.ts` |
| Core managers | session/task/approval/event/project | `tests/unit/core/managers.test.ts` |

## Real integration (6)

Run against a live `codex app-server --listen stdio://` with the local model
provider proxy:

1. `initialize` handshake -> `ready`, capabilities exposed.
2. `model/list` (health check).
3. `thread/start` -> thread created with id + cwd.
4. `turn/start` with a text task -> streamed `item/agentMessage/delta` output,
   `turn/completed`, full answer text received.
5. `thread/resume` -> same thread id returned.
6. `turn/interrupt` -> a live turn was interrupted and ended cleanly.

The integration run emitted real events in order (`session.created`,
`turn.started`, `item.started`, `item.completed`, `turn.completed`) and produced
the expected streamed answer.

## Verified protocol facts

- `turn/start` requires `{ threadId, input: [{ type: "text", text }] }`.
- `turn/steer` requires `{ threadId, expectedTurnId, input }`.
- `turn/interrupt` requires `{ threadId, turnId }`.
- `TurnStatus` = `completed | interrupted | failed | inProgress`.
- Approval responses: command/file = `{ decision: "accept"|"decline"|"cancel" }`;
  permissions = `{ permissions, scope }`; tool input = `{ answers }`.

## Not yet integration-verified (recorded limitation)

- **Approval prompt in a live turn** is implemented and unit-tested (command,
  file-change, permissions, tool-input decision mapping), but a live approval
  prompt was not triggered in this environment: the model did not issue a
  command that required approval under the current sandbox policy. The
  approval request/respond path is covered by unit tests; the end-to-end
  approval prompt depends on the model actually requesting an approval-requiring
  operation and is documented rather than claimed as passing.

## Windows notes

- Verified process spawn/stop and stdio separation on Windows 11 x64.
- The App Server writes to `%USERPROFILE%\.codex`; the integration test requires
  host filesystem/network access (outside the restricted sandbox).

## Phase 3 real integration (6)

`npm run test:core` runs the full Core against the real App Server:

1. `initialize` -> `ready` + capabilities.
2. `openProject` -> real project with Git detection.
3. `createSession` + `sendMessage` -> real task, streamed output.
4. Message history persisted (user + assistant).
5. Task + tool execution records persisted.
6. `shutdown` -> restart -> `resumeSession` -> history restored.

## Fault-recovery coverage

- Config corruption -> reset to defaults (unit).
- Subscriber throwing -> isolated (unit).
- Duplicate approval response -> rejected (unit).
- Session-level task lock -> duplicate submission rejected (unit).
- Unknown adapter events -> dropped, not fatal (unit).

## Phase 4 (TUI)

`npm test` includes 82 tests: the Phase 2-3 suites plus 20 TUI tests covering
the `uiReducer` (streaming merge, approval modal, status transitions), keyboard
action resolution (IME-safe, modal handling), formatting helpers, and CLI
argument parsing.

A real TUI smoke run (PowerShell, `--cwd` to the repository) initialized the
Core against a live `codex app-server` and rendered the Welcome screen with the
DICODE logo, `Ready` status, and the detected project path.

## Phase 5

`npm test` is 90 tests: added Slash-command parsing/help, Markdown parsing and
plain-text conversion, highlight.js line segmentation, and Git porcelain
parsing. Model list/selection and reasoning effort reuse the verified `model/list`
and `turn/start.model/effort` protocol paths; capability boundaries are recorded
in `docs/codex-feature-matrix.md`.
