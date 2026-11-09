# Installation

The production deliverables are:

```text
Dicode-Setup-x64.msi
Dicode-Portable-x64.zip
```

These are produced in Phase 6. This document records the intended layout and
behavior so it can be implemented without re-deriving decisions.

## Install layout

```text
Dicode/
  Dicode.exe
  runtime/
    codex.exe            (pinned version + companion binaries)
  resources/
    logo/
    themes/
  uninstall.exe
```

## User data

```text
%APPDATA%\Dicode\
  config/
  sessions/
  logs/
  cache/
```

Per-project configuration:

```text
<project>/.dicode/config.json
```

Rules: user data is never written to the install directory, and Dicode never
overwrites the user's existing `~/.codex` configuration.

## MSI install steps

1. Install Dicode.
2. Deploy the Codex runtime.
3. Create the user config directory.
4. Write default configuration.
5. Add `dicode` to PATH.
6. Create a Start Menu entry.
7. Run a runtime self-check.
8. Complete.

## CLI surface

```powershell
dicode
dicode --version
dicode --help
dicode doctor
dicode config
dicode resume
dicode mcp
dicode skills
```

`dicode` with no arguments enters the TUI. Missing runtime or auth must show
clear guidance/diagnostics rather than crashing.

## Compatibility targets

- Windows 10 x64 and Windows 11 x64.
- CMD, PowerShell 5.1, PowerShell 7, Windows Terminal.
- Chinese/space-containing paths, terminal resize, Ctrl+C, subprocess exit, and
  abnormal recovery.

## Licensing

Before packaging, the Codex runtime and its dependencies must be re-checked for
license and redistribution terms.
