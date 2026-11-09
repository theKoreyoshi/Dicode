# Codex Runtime 分发合规性检查

## 结论：满足指定条件后可分发（待权利方最终确认）

阶段 6.1 已联网核查官方仓库 `github.com/openai/codex` 的 LICENSE，为 Apache
License 2.0。Apache 2.0 允许以对象/二进制形式再分发，但不授予商标权。

正式发布仍需满足：稳定版本（非 alpha）、随包附带 LICENSE/NOTICE、确认官方二进制
组件构成、不暗示 OpenAI 背书。详见 `docs/packaging/runtime-license-audit.md`。

## 版本锁定与来源记录

- 版本：`0.167.0-alpha.3.2`（开发期本地集成测试所用）。
- 来源：本地已安装的官方 Codex CLI（`codex --version` 确认）。
- 校验：`tools/generate-runtime-manifest.mjs` 生成 `runtime/codex/version.json`
  （含 SHA-256 + 文件大小）。

## 本地集成（仅开发）

开发期通过 `DICODE_CODEX_EXE` 环境变量指向本地 codex.exe 完成集成测试；正式产品
运行时优先使用内置 `runtime/codex/codex.exe`，不依赖开发电脑上的安装目录。
