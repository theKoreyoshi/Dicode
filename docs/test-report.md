# Test Report — Phase 2 (Codex Adapter)

Generated 2026-11-09. Codex Runtime `0.167.0-alpha.3.2`.

## Summary

| Suite | Command | Result |
| --- | --- | --- |
| Type check | `npm run typecheck` | PASS |
| Lint | `npm run lint` | PASS |
| Unit tests | `npm test` | 43/43 PASS |
| Real integration | `npm run test:codex` | 6/6 PASS |

## Unit tests (43)

| Module | Coverage | File |
| --- | --- | --- |
| JSON-RPC primitives | request/notification/response/error framing | `tests/unit/shared.test.ts` |
| Protocol registry vs generated schema | method-name consistency | `tests/unit/protocol.test.ts` |
| LineFramer | chunk reassembly, multi-line, limits, reset | `tests/unit/adapter/message-parser.test.ts` |
| RequestManager | resolve/reject/timeout/fail-all/duplicate | `tests/unit/adapter/request-manager.test.ts` |
| JsonRpcClient | correlation, errors, notifications, server requests | `tests/unit/adapter/jsonrpc-client.test.ts` |
| Event mapper | turn/item/tool/shell/file/unknown mapping | `tests/unit/adapter/event-mapper.test.ts` |
| Thread/Turn/Approval managers | protocol mapping + state tracking | `tests/unit/adapter/managers.test.ts` |

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
