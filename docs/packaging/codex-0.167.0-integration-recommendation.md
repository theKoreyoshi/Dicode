# 后续集成建议

## 结论：方案 A（保留原启动方式）

`codex.exe app-server --listen stdio://` 在 0.167.0 中仍然有效，且协议与当前 Adapter
完全兼容，因此：

- 当前 Adapter 无需修改。
- 后续集成只需将稳定版 `codex.exe` 放入 `runtime/codex/`，并更新 version.json。
- 独立的 `codex-app-server.exe` 无需使用（它是另一种部署形态，不影响本产品）。

## 需要修改的代码

无生产代码修改。仅需在集成阶段：

1. 将稳定版 codex.exe 放入 runtime/codex/。
2. 更新 runtime/codex/version.json（版本号、SHA-256）。
3. 附带 LICENSE/NOTICE（合规要求）。
