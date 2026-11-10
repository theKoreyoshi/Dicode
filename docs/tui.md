# Dicode TUI

Run `dicode` in a Windows terminal, then type a request and press Enter.
Dicode creates a Codex thread on the first accepted prompt. Sessions, messages
and tool activity are stored in the Dicode user data directory.

The layout follows the [OpenCode TUI](https://opencode.ai/docs/cli/tui/) with a
centered composer at startup, a scrollable session view, and a sidebar for context
usage and recent changes on wide terminals. Dicode's agent, model catalog, tools
and approvals come from the [Codex App Server](https://learn.chatgpt.com/docs/app-server).

## Keyboard

| Key | Action |
| --- | --- |
| Enter | Submit a prompt, or steer the active turn |
| Ctrl+X, Enter | Queue one follow-up for the active session |
| Shift+Enter or Ctrl+J | Insert a newline. Use Ctrl+J when the terminal sends the same code for Shift+Enter and Enter |
| ↑ / ↓ | Move between draft lines or browse prompt history |
| Ctrl+A / Ctrl+E | Move to the beginning or end of the current input line |
| PageUp / PageDown | Scroll the transcript |
| Ctrl+P | Search commands |
| Ctrl+O or Ctrl+X, L | Search and resume a session |
| Ctrl+X, N | Return to the new-session composer |
| Ctrl+X, M | Choose a model |
| Ctrl+X, B | Toggle the sidebar on wide terminals |
| Shift+Tab | Switch between Build and Plan |
| Ctrl+T | Cycle the current model's reasoning effort |
| Tab | Complete the selected slash command or file path |
| Esc | Close the current picker or interrupt an active turn |
| Ctrl+C | Interrupt an active turn |
| Ctrl+Q | Exit Dicode |

Type `/` for command suggestions. `/new` and `/clear` start a fresh
conversation. `/sessions`, `/resume` and `/continue` open the session picker.
Use `/cd` to pick a recent project or `/cd <path>` to open a directory.
`/tools` expands tool output and `/diff` displays the latest reported turn
diff. `/status` displays the runtime connection and working directory.

Type `@` followed by part of a filename to find project files. Tab inserts a
workspace-relative reference in the prompt for Codex to read. The completion
list uses the current project's Codex file search.

When Codex requests approval, the request takes keyboard focus. Review the
command or permission details, then select **Allow once** or **Deny**. For
questions in Plan mode, choose an answer or enter text when the request supports
it. Finish or interrupt an active turn before switching sessions or projects.

OpenCode's dedicated `!` shell composer, editor integration, and message-level
undo and redo are outside this Dicode release. Codex tool executions are shown
in the session transcript.

## Development

```powershell
npm ci
npm run dev -- --cwd "D:\Projects\Demo"
npm run dev -- --resume
npm run dev -- doctor
```

`--resume` resumes the newest Dicode session for the selected project.
