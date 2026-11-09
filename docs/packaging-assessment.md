# Dicode 打包评估报告（阶段 6）

## 当前构建方式

- Monorepo（npm workspaces）：`shared` / `codex-adapter` / `core` / `tui` / `cli`。
- TypeScript 源码，`tsc --noEmit` 类型检查 + Vitest 测试。
- 开发运行：`tsx packages/cli/src/index.ts`。
- 尚未配置生产构建（dist 输出 / 单文件 EXE）。

## Codex Runtime 现状

| 项目 | 值 |
| --- | --- |
| 版本 | `codex-cli 0.167.0-alpha.3.2` |
| 位置 | `%LOCALAPPDATA%\OpenAI\Codex\bin\<hash>\` |
| 主程序 | `codex.exe`（约 352 MB，自包含 Rust 二进制）|
| 伴生二进制 | `codex-code-mode-host.exe`（77MB）、`codex-command-runner.exe`（8.5MB）、`codex-windows-sandbox-setup.exe`（18.7MB）|
| 合计 | 约 455 MB |
| 协议 | App Server v1/v2，JSON-RPC over stdio（`--listen stdio://`）|

## 运行时调用关系

`dicode` → Core → Adapter（`spawn codex app-server --listen stdio://`）→ App Server。
Adapter 当前通过 `resolveCodexExecutable()` 定位 codex.exe，已改造为支持内置 Runtime。

## 打包后的潜在问题

1. **分发合规性**：Codex 安装目录中未发现 LICENSE 文件，重新分发条款未知（见
   `runtime-distribution.md`）。这是正式发布前的阻塞项。
2. **单文件 EXE 与 `node:sqlite`**：`node:sqlite` 是 Node 22+ 内置模块，pkg/nexe
   需验证是否支持；Ink TUI + 子进程 + SQLite 需在打包后真实验证。
3. **体积**：Runtime 约 455MB，安装包较大。
4. **干净环境测试**：需在无 Node.js、无独立 Codex 的 Windows VM 验证。

## 推荐目录结构

```text
Dicode/
  bin/dicode.exe
  runtime/codex/{codex.exe, codex-code-mode-host.exe, codex-command-runner.exe, codex-windows-sandbox-setup.exe, version.json}
  resources/
  uninstall/
  version.json
```

## 已完成代码改造

- Adapter `resolveCodexExecutable()` 支持内置 Runtime 优先（`<exe>/../runtime/codex/codex.exe`）。
- `dicode --doctor` 环境诊断（环境/版本/Runtime/完整性/App Server/SQLite）。
- `runtime/codex/version.json` + `tools/generate-runtime-manifest.mjs` 校验和生成。
