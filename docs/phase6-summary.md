# 阶段 6 总结

## 最终产品架构

```text
dicode (Dicode-Setup-x64 / Portable)
  └── bin/dicode.exe          Dicode CLI + TUI（React + Ink）
  └── runtime/codex/          codex.exe + 伴生二进制 + version.json
  └── resources/              静态资源
```

Dicode 产品层（TUI/Core/Adapter）与 Codex Runtime 一体化，通过 App Server
（JSON-RPC over stdio）通信。

## Codex Runtime 实际版本

`0.167.0-alpha.3.2`（Windows x64，约 455MB：codex.exe + 3 个伴生二进制）。

## 实现情况

| 项 | 状态 |
| --- | --- |
| 内置 Runtime 路径解析 | 已完成（`<exe>/../runtime/codex/codex.exe` 优先）|
| `dicode --doctor` | 已完成（环境/版本/Runtime/校验/App Server/SQLite）|
| version.json + 校验和脚本 | 已完成 |
| 独立 EXE 构建 | **未完成**（需 Node SEA/pkg 验证 + 打包工具）|
| 一体化安装包 | **未完成**（分发合规 + 打包工具 + 干净 VM 测试）|
| 升级/卸载 | **未完成**（依赖安装包）|
| 干净 Windows 全链路测试 | **未完成**（本环境无干净 VM）|

## 阻塞项（如实报告）

1. **分发合规性**：Codex 无可见 LICENSE，重新分发条款未确认，不能擅自随包分发。
2. **打包工具链**：未配置 Inno Setup/WiX 与 Node SEA/pkg 构建。
3. **干净环境测试**：本环境无法提供无 Node.js、无独立 Codex 的干净 Windows VM。

## 已通过测试

- `npm run typecheck` / `lint` / `test`（90 单元测试）。
- 真实 App Server 集成（`test:core`，真实 Codex 任务）。
- TUI 真实冒烟运行。
- `dicode --doctor` 真实诊断（下阶段验收时验证）。

## 遗留事项

1. 确认 Codex 分发许可后再构建正式安装包。
2. 完成单文件 EXE 构建与 Ink/子进程/SQLite 打包验证。
3. 配置安装程序（Inno Setup 或 WiX）与 PATH/快捷方式/卸载。
4. 在干净 Windows VM 完成安装/运行/升级/卸载测试。
