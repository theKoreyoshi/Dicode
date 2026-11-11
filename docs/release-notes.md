# Dicode v0.1.0 Release Notes

> AI Coding Agent for Developers

发布日期：2026-11-10

## 概述

Dicode 是一款独立的 Windows 代码助手 CLI，以官方 Codex CLI 为底层 Agent 引擎，
通过 Codex App Server 驱动，并提供自研的终端界面、会话管理与完整交互体验。

本版本为**内部测试版本**，已完整打通「安装 → 启动 → 真实 Agent 任务 → 审批 → 会话恢复」
全链路。

## 亮点

- 独立 Windows 安装包，内嵌 Node.js 26 与 Codex 0.167.0 稳定版 Runtime，无需额外安装依赖
- React + Ink 终端界面（欢迎页 / 聊天 / 侧边栏 / 状态栏）
- 真实流式输出、工具调用展示、权限审批、文件变更与 Diff
- 模型选择与推理等级切换
- Markdown 渲染 + 代码语法高亮
- Slash 命令体系与快捷键
- `dicode --doctor` 环境诊断
- SQLite 会话/消息/任务持久化，重启可恢复历史会话

## 安装

下载 `Dicode-Setup-x64.exe`，双击安装（支持当前用户安装、自定义目录），完成后在
PowerShell / Windows Terminal 执行：

```powershell
dicode
```

## 系统要求

- Windows 10 / 11 x64
- 无需预装 Node.js、无需单独安装 Codex CLI
- 首次使用需通过 Codex 官方机制完成账号登录

## 已知限制

- 本版本复用 Codex 原生能力，未包含 Multi-Agent、自定义编排等扩展能力
- 独立 `codex-app-server.exe` 未使用（沿用 `codex app-server` 子命令）

## 合规说明

安装包内嵌 OpenAI 官方 `codex.exe`，本版本仅供内部测试；正式对外分发前需取得
权利方/法务书面确认并补充 LICENSE / NOTICE。

## 校验

```
Dicode-Setup-x64.exe
SHA-256: 82551fbf58bd9ed0d7f27eeae14fb91e4172b455bb04a347701602b89b96bcd8
```
