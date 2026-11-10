# Bundled Codex Runtime

The Windows packages stage the official Codex coding runtime under `runtime/codex`
beside `dicode.exe`. The pinned `version.json` lists the exact source archive and
the SHA-256 and size of each included file. The optional upstream voice subtree
is outside Dicode's coding experience.

Use `npm run package:windows -- <Codex release tar.gz> [ISCC.exe]` from the
repository root with Windows x64 Node.js 26 and Inno Setup 6. The builder verifies
the archive and each runtime file, keeps the official package layout, and stages
Codex LICENSE and NOTICE and the applicable Node.js and ripgrep notices.
