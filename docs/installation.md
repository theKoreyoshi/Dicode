# Installation

Dicode ships for Windows x64 as `Dicode-Setup-x64.exe` and
`Dicode-Portable-x64.zip`. Both include Node.js and the official
Codex 0.167.0 Windows x64 coding runtime.
See the [Windows installation guide](windows-installation.md) for setup,
runtime discovery, and uninstall behavior.

After installing, open a new terminal and run:

```powershell
dicode doctor
dicode login
dicode --cwd "D:\Projects\Demo"
dicode --resume
```

From a portable folder, substitute `.\dicode.exe` for `dicode`. Dicode user
data is stored under `%APPDATA%\Dicode\`. Codex keeps its authentication and
configuration in its own user directory. Use `dicode login` when diagnostics
report that sign-in is needed.

## Build on Windows

Use Windows x64 Node.js 26 and Inno Setup 6. Pass the official
[Codex 0.167.0 Windows x64 archive](https://github.com/openai/codex/releases/download/rust-v0.167.0/codex-package-x86_64-pc-windows-msvc.tar.gz)
to the packaging command. The command verifies the archive before staging it.

```powershell
npm ci
npm run package:windows -- "C:\Downloads\codex-package-x86_64-pc-windows-msvc.tar.gz" "C:\Tools\Inno Setup 6\ISCC.exe"
```

Use `DICODE_SEA_NODE` to point the build at a Windows Node.js 26 executable
when the development shell uses a different Node.js version. The build writes
the installer, portable ZIP, and a runnable copy under `release/`. Open
`release/dicode.exe` directly, or run `release/dicode.exe doctor` from the
repository root. When moving the runnable copy, keep `runtime/` beside
`dicode.exe`.

Set `DICODE_RELEASE_DIR` to a different output directory when building alongside
an active Dicode session.
