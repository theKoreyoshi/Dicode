# Codex Runtime 正式版本选型

## 官方发布渠道核查

- 官方仓库：https://github.com/openai/codex
- Releases API：https://api.github.com/repos/openai/codex/releases

## 版本对比

| 版本 | 发布类型 | 发布日期 | 建议 |
| --- | --- | --- | --- |
| rust-v0.169.0-alpha.3 | 预发布 | 2026-11-07 | 否 |
| rust-v0.168.0-alpha.7 | 预发布 | 2026-11-05 | 否 |
| rust-v0.167.0 | **正式稳定** | 2026-11-06 | **推荐** |
| rust-v0.167.0-alpha.3.2 | 预发布 | 2026-11-05 | 否（当前开发所用）|

## 推荐版本

**rust-v0.167.0**（唯一 `prerelease: false` 的正式稳定版本，发布日期 2026-11-06）。

选择理由：这是当前唯一非 alpha 的稳定版本，与当前 alpha `0.167.0-alpha.3.2` 同属
v0.167 系列，协议兼容性风险最小。

## 关键兼容性风险（需在集成阶段验证）

稳定版发布包中 `codex.exe` 与 `codex-app-server.exe` 为**独立二进制**（另有
`codex-app-server-package`）。Dicode 当前通过 `codex app-server --listen stdio://`
启动，需验证稳定版 `codex.exe` 是否仍支持该子命令，或需改用独立的 app-server 二进制。
