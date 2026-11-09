# Codex Runtime 组件清单（rust-v0.167.0，Windows x64）

来源：官方 GitHub Releases（rust-v0.167.0）

| 组件 | 大小 | 用途 | 许可证 | 随包 |
| --- | --- | --- | --- | --- |
| codex-x86_64-pc-windows-msvc.exe | 351.97MB | Codex CLI 主程序 | Apache 2.0（源码）| 待确认 |
| codex-app-server-x86_64-pc-windows-msvc.exe | 267.83MB | App Server（独立）| 待核查 | 待确认 |
| codex-code-mode-host-x86_64-pc-windows-msvc.exe | 76.61MB | Code-mode host | 待核查 | 视场景 |
| codex-windows-sandbox-setup-x86_64-pc-windows-msvc.exe | 18.66MB | Windows 沙箱配置 | 待核查 | 视场景 |
| codex-windows-sandbox-service-x86_64-pc-windows-msvc.exe | 54.85MB | Windows 沙箱服务 | 待核查 | 视场景 |
| codex-responses-api-proxy-x86_64-pc-windows-msvc.exe | 8.99MB | Responses API 代理 | 待核查 | 视场景 |
| config-schema.json | 0.25MB | 配置 schema | 待核查 | 否 |
| install.ps1 | 0.07MB | 官方安装脚本 | 待核查 | 否 |

## 说明

- 发布包未提供官方 SBOM、NOTICE 或第三方依赖清单。
- 未发现 Windows x64 产物的 `.sigstore` 签名文件（仅 Linux 产物有）。
- 第三方组件的完整许可证构成无法从发布包确认，需权利方补充。
