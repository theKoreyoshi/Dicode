# Dicode TUI

Run `dicode` in a Windows terminal, then type a request and press Enter.
Dicode creates a Codex thread on the first accepted prompt. Sessions, messages
and tool activity are stored in the Dicode user data directory.

The prompt has its own border and a separate settings row for agent mode, model,
and reasoning effort. The transcript scrolls above the prompt. Wide terminals
also show a sidebar with context usage and recent changes.

The default transcript shows user prompts, tool calls and their status, the
proposed plan, and the final answer. `/tools` expands command output and
intermediate messages. Use `/diff` to inspect file changes. Message phases and
tool status come from the [Codex App Server](https://learn.chatgpt.com/docs/app-server).

Dicode restores the shell screen on exit. Adapter diagnostics are saved in
`%APPDATA%\Dicode\logs\adapter.log`.

## Keyboard

| Key | Action |
| --- | --- |
| Enter | Submit a prompt, or steer the active turn |
| Ctrl+X, Enter | Queue one follow-up for the active session |
| Shift+Enter or Ctrl+J | Insert a newline. Use Ctrl+J when the terminal sends the same code for Shift+Enter and Enter |
| ↑ / ↓ | Move between draft lines or browse prompt history |
| Ctrl+A / Ctrl+E | Move to the beginning or end of the current input line |
| Mouse wheel | Scroll the transcript while keeping the draft intact |
| PageUp / PageDown | Scroll the transcript |
| Ctrl+P | Search commands |
| Ctrl+O or Ctrl+X, L | Search and resume a session |
| Ctrl+X, N | Return to the new-session composer |
| Ctrl+X, M | Choose a model |
| Ctrl+X, S | Inspect runtime and session settings |
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
`/status` displays the runtime connection, working directory, agent mode,
model, and reasoning effort.
Use `/plan` to switch to Codex Plan mode or `/plan <prompt>` to submit a
planning request. The transcript shows plan progress and the final proposal
from the runtime.

Type `@` followed by part of a filename to find project files. Tab inserts a
workspace-relative reference in the prompt for Codex to read. The completion
list uses the current project's Codex file search.

When Codex requests approval, the request takes keyboard focus. Review the
command or permission details, then select the applicable scope or **Deny**.
When the runtime offers it, command and file approvals can apply to the session. For
questions in Plan mode, choose an answer or enter text when the request supports
it. Finish or interrupt an active turn before switching sessions or projects.

OpenCode's dedicated `!` shell composer, editor integration, and message-level
undo and redo are outside this Dicode release. Codex tool executions are shown
in the session transcript.

## Custom models

Open `/model-config`, choose **Configure custom model** in `/models` or the
command palette, or press `M` in `/status`. Enter the provider's exact model ID
and the base URL that serves the OpenAI Responses API, such as
`https://gateway.example/v1`. Codex appends `/responses` to this base URL.
A provider that only serves Chat Completions needs a Responses-compatible
gateway. See [Codex custom model providers](https://learn.chatgpt.com/docs/config-file/config-advanced#custom-model-providers).

If the provider requires a bearer token, set a provider-specific environment
variable in the shell before starting Dicode and enter its **name** in the
**Key variable** field. Dicode stores the name with the model configuration.
Use HTTPS for authenticated remote endpoints. For a local provider that allows
unauthenticated requests, leave the field blank.

Use Tab or the arrow keys to move through the form and Enter to select
**Save and use**. The next conversation uses the configured provider and model.
You can change the default later or select **Use Codex defaults** in the same
form. Dicode preserves the draft and resumes existing sessions with their
original provider settings. Wait for the active turn to finish or interrupt it
before saving a different model configuration.

## Development

```powershell
npm ci
npm run dev -- --cwd "D:\Projects\Demo"
npm run dev -- --resume
npm run dev -- doctor
```

`--resume` resumes the newest Dicode session for the selected project.
