# Dicode 与 Codex CLI 0.167.0 的功能对齐

Windows 发行包固定使用官方 Codex 0.167.0。Dicode TUI 通过 Core 和
Adapter 使用 App Server 的 stdio JSON-RPC。以下状态以该版本的生成
Schema 和实际验证为准。参见 [App Server 文档](https://learn.chatgpt.com/docs/app-server)
和 [Codex 0.167.0 原生命令](https://github.com/openai/codex/blob/rust-v0.167.0/codex-rs/tui/src/slash_command.rs)。

| 操作 | App Server | Dicode | 验证 |
| --- | --- | --- | --- |
| 新会话、多轮对话 | `thread/start`、`turn/start` | Adapter、Core、TUI | 真实运行时 |
| 流式回复、追加指令、中断 | `item/agentMessage/delta`、`turn/steer`、`turn/interrupt` | Adapter、Core、TUI | 真实流式与中断，追加指令有协议和自动化覆盖 |
| 会话恢复 | `thread/resume` | Adapter、Core、TUI 通过 Dicode 会话索引恢复 | 真实重启恢复 |
| 模型与推理强度 | `model/list`、`turn/start` | Adapter、Core、TUI | 模型目录实测，选择参数有测试 |
| 自定义模型 | `model_providers`、`model_provider`、Responses API | `/model-config` 保存 Dicode 的模型 ID、地址与密钥变量名，新会话使用该提供商 | 真实运行时验证切换、恢复、凭据隔离和错误脱敏 |
| Plan 模式 | `collaborationMode`、`turn/plan/updated`、`item/plan/delta` | Adapter、Core、TUI 提供 `/plan`、进度与最终方案 | 原生 Plan 事件与终端渲染分别验证 |
| 命令、文件、MCP 工具 | 工具与输出通知、`turn/diff/updated` | Adapter、Core、TUI 展示工具、输出与最新一轮 Diff | 文件编辑和真实 Diff 有验证 |
| 命令和文件审批 | App Server 双向审批请求与解析通知 | Adapter、Core、TUI 提供服务端允许的单次与会话范围 | 真实请求及中断撤回，终端选择有自动化覆盖 |
| 权限与用户输入 | `item/permissions/requestApproval`、`item/tool/requestUserInput` | Adapter、Core、TUI 提供显式授权和输入选择 | 协议与终端测试 |
| 登录与诊断 | `account/read`、`account/login/start` | CLI 提供 `dicode login` 和 `dicode doctor` | 协议测试与 Windows 包验证 |
| 配置、MCP 和 Skills 列表 | `config/read`、`mcpServerStatus/list`、`skills/list` | CLI 提供 `dicode config`、`dicode mcp`、`dicode skills` | App Server 只读请求 |
| 项目文件搜索 | `fuzzyFileSearch` | TUI 的 `@` 将路径插入草稿 | Windows 交互测试 |

Dicode 的会话选择使用自己的会话索引，Codex 原生历史导入与管理仍待对齐。
`/diff` 展示 Codex 报告的最近一轮变更。Codex 原生的 Git 工作区 Diff、独立
Shell 输入、媒体附件、审查、上下文压缩、分叉与归档界面、MCP 表单、
权限规则编辑、插件管理、远程会话和语音仍有界面或操作差异。

验证记录见 [测试报告](test-report.md)。
