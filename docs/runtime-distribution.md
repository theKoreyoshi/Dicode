# Codex Runtime 分发合规性检查

## 结论：阻塞（需人工确认）

本阶段**未**将 `codex.exe` 正式随安装包分发，原因如下：

1. 当前 Codex 安装目录（`%LOCALAPPDATA%\OpenAI\Codex\bin\<hash>\`）中**未发现
   LICENSE 文件**，无法确认其重新分发许可条款。
2. Codex CLI 是 OpenAI 的专有软件，其许可条款可能禁止或限制随第三方产品重新分发。
3. 项目规范明确要求：**不得使用来源不明的 codex.exe，不得在许可证不允许时擅自绕过授权条件**。

因此，正式发布前必须由具备相应权限的负责人：

- 从官方渠道（https://github.com/openai/codex）确认 `codex.exe` 的许可与分发条款。
- 确认是否允许随 Dicode 安装包重新分发，或要求用户通过官方渠道单独获取 Codex。

## 版本锁定与来源记录

- 版本：`0.167.0-alpha.3.2`（开发期本地集成测试所用）。
- 来源：本地已安装的官方 Codex CLI（`codex --version` 确认）。
- 校验：`tools/generate-runtime-manifest.mjs` 生成 `runtime/codex/version.json`
  （含 SHA-256 + 文件大小）。

## 本地集成（仅开发）

开发期通过 `DICODE_CODEX_EXE` 环境变量指向本地 codex.exe 完成集成测试；正式产品
运行时优先使用内置 `runtime/codex/codex.exe`，不依赖开发电脑上的安装目录。
