# Codex 0.167.0 App Server 兼容性验证

## 下载与校验

- 版本：rust-v0.167.0（codex-cli 0.167.0，正式稳定）
- 文件：codex-x86_64-pc-windows-msvc.exe（352MB）
- SHA-256：edfdd48f8b458af0906e507b4cb05217b326c3d6e515e9f024e05e3b8d650f70
- 来源：https://github.com/openai/codex/releases/tag/rust-v0.167.0

## 实测结果

| 验证项 | 结果 |
| --- | --- |
| codex.exe --version | codex-cli 0.167.0 |
| codex.exe app-server --help | 支持（daemon/proxy/generate-ts/generate-json-schema）|
| codex.exe app-server --listen stdio:// | 正常启动，持续运行等待 stdin |
| initialize | 成功（userAgent: Codex Desktop/0.167.0 ... dicode 0.1.0）|
| initialized 通知 | 成功 |
| account/read | 成功（apiKey）|
| model/list | 成功（deepseek-v4-flash / deepseek-v4-pro）|
| thread/list | 成功（返回历史会话）|
| config/read | 成功 |
| stderr 分离 | 正常（日志在 stderr，stdout 仅 JSON-RPC）|
| 退出清理 | 正常（exit 0）|

## 结论

**codex.exe app-server --listen stdio:// 在 0.167.0 中仍然有效**，子命令未移除。
