# Installation

Dicode ships for Windows x64 as `Dicode-Setup-x64.exe` and
`Dicode-Portable-x64.zip`. The executable embeds Node.js. The default
distribution connects to a complete official Codex runtime installed on the machine.
See the [Windows installation guide](windows-installation.md) for setup,
runtime discovery, and uninstall behavior.

After installing, open a new terminal and run:

```powershell
dicode doctor
dicode --cwd "D:\Projects\Demo"
dicode --resume
```

From a portable folder, substitute `.\dicode.exe` for `dicode`. Dicode user
data is stored under `%APPDATA%\Dicode\`. The Codex runtime reads its existing
authentication and model configuration.

## Build on Windows

Use Windows x64 Node.js 26 for the single-executable build and Inno Setup 6 for
the installer:

```powershell
npm ci
npm run build:exe
iscc installer\inno\dicode.iss
```

Use `DICODE_SEA_NODE` to point the build at a Windows Node.js 26 executable
when the development shell uses a different Node.js version. The build writes
`release/dicode.exe` and a SHA-256 record in `release/build-info.json`.
