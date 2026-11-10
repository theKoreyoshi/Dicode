# Codex Runtime 来源与校验

Dicode 的 Windows x64 安装包和便携包使用 OpenAI 官方
`rust-v0.167.0` 发布中的 `codex-package-x86_64-pc-windows-msvc.tar.gz`。
构建时校验官方归档的 SHA-256 并保留编码运行时的目录结构。
见 [官方 Codex 0.167.0 发布](https://github.com/openai/codex/releases/tag/rust-v0.167.0)。

| 文件 | 用途 |
| --- | --- |
| `codex-package.json` | 官方包布局 |
| `bin/codex.exe` | Codex App Server |
| `bin/codex-code-mode-host.exe` | 编码工具主机 |
| `bin/codex-exec-server.exe` | 命令执行服务器 |
| `codex-resources/codex-command-runner.exe` | Windows 命令运行器 |
| `codex-resources/codex-windows-sandbox-setup.exe` | Windows 沙箱设置 |
| `codex-path/rg.exe` | ripgrep 文件搜索 |

Dicode 通过 `codex.exe app-server --listen stdio://` 使用运行时。
构建产物包含相关许可证和版权声明，`runtime/codex/version.json` 记录归档来源和各文件的
SHA-256 与大小。可选语音资源属于独立的分发子集，Dicode 当前使用编码运行时。
认证、模型配置与会话存放在用户目录中。

开发运行可以用 `DICODE_CODEX_EXE` 指向完整运行时的 `bin/codex.exe`。
安装版和便携版固定加载随包分发的 Codex。运行 `dicode doctor` 验证安装，
或在提示需要账号时使用 `dicode login`。
