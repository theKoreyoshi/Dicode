# Codex Runtime 文件完整盘点

核查时间：2026-11-09（Windows 11 x64）

Runtime 版本：`codex-cli 0.167.0-alpha.3.2`

来源目录：`%LOCALAPPDATA%\OpenAI\Codex\bin\f71a721e0e6193a9\`

| 文件名 | 大小(Bytes) | 大小 | SHA-256(前16位) | 用途 | 是否必需 |
| --- | --- | --- | --- | --- | --- |
| codex.exe | 369018160 | 351.9MB | 4b3286e35d7fe866 | Codex CLI 主程序，承载 app-server | 是 |
| codex-code-mode-host.exe | 80331056 | 76.6MB | a628447ae7784b4a | Code-mode host（IDE 集成）| 视场景 |
| codex-command-runner.exe | 8946480 | 8.5MB | 20a9a6dab22c4fd0 | Shell 命令执行器 | 视场景 |
| codex-windows-sandbox-setup.exe | 19563312 | 18.7MB | e0cf157829248c7a | Windows 沙箱配置 | 视场景 |

合计约 455.9MB。

## 说明

- 四个文件均为 Rust 自包含二进制，Windows VersionInfo 资源为空。
- 安装目录内未发现 codex 自身的 LICENSE/NOTICE 文件。
- Dicode 只通过 `codex app-server --listen stdio://` 使用 codex.exe；其余三个二进制
  是否随包分发取决于 App Server 实际调用，需在打包验证阶段确认。
