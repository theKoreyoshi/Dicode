# Codex 原生能力对标矩阵

基准：Codex `0.167.0-alpha.3.2`，App Server 协议 v1/v2（来自
`schemas/codex-app-server/` 生成的权威 Schema）。

分类：A=已接入，B=Codex 支持待接入，C=Codex 支持但 App Server 未暴露，D=Codex 不支持。

| 功能 | Codex 原生 | 协议接口 | Dicode 状态 | 分类 |
| --- | --- | --- | --- | --- |
| 会话创建/恢复/列表/归档/删除/Fork | 是 | `thread/start` `thread/resume` `thread/list` `thread/archive` `thread/delete` `thread/fork` | 已接入 | A |
| 用户输入/流式 Agent 输出 | 是 | `turn/start` `item/agentMessage/delta` `turn/completed` | 已接入 | A |
| 任务取消/追加 | 是 | `turn/interrupt` `turn/steer` | 已接入 | A |
| 模型列表 | 是 | `model/list` | 待接入 | B |
| 模型切换 | 是 | `thread/start.model` `turn/start.model` | 待接入 | B |
| 推理等级 (Reasoning Effort) | 是 | `turn/start.effort` + `model/list.supportedReasoningEfforts` | 待接入 | B |
| Shell/工具调用 | 是 | `item/commandExecution/*` `process/*` `command/exec` | 已接入(基础) | A |
| 命令/权限审批 | 是 | `item/commandExecution/requestApproval` `item/fileChange/requestApproval` `item/permissions/requestApproval` | 已接入 | A |
| 文件变更事件 | 是 | `item/fileChange/outputDelta` `item/fileChange/patchUpdated` | 已接入(事件) | A |
| Diff 数据 | 是 | `turn/diff/updated` | 待接入 | B |
| MCP 列表/状态 | 是 | `mcpServerStatus/list` `mcpServer/*` | 待接入 | B |
| Skills 列表 | 是 | `skills/list` `skills/config/write` | 待接入 | B |
| 图片/文件附件输入 | 部分 | `turn/start.input` 支持 `image`/`localImage`/`localAudio` 类型 | 待接入 | B |
| 配置读取/写入 | 是 | `config/read` `config/value/write` | 读取已接入 | A |
| 项目列表/读取 | 是 | `project/list` `project/read` | 未接入 | B |
| Git 状态/Diff | 否(产品补充) | 无原生接口，用只读 `git` 命令 | 待接入 | B(产品) |
| Markdown/代码高亮 | 产品 UI | 无 | 待接入 | B(产品) |
| 消息滚动 | 产品 UI | 无 | 待接入 | B(产品) |
| Multi-Agent | 部分(ultra effort) | `multiAgentMode` 已废弃 | 不开发 | D |
| 自定义 Planner/Worker/记忆 | 否 | 无 | 不开发 | D |
| 自定义上下文压缩 | 否 | 无 | 不开发 | D |
| 自动 Commit/Push | 否(产品可做但本版不做) | 无 | 不开发 | D |

## 结论

本版本 Agent 能力完全复用 Codex 原生：会话、消息、工具、审批、文件变更、模型、
推理等级均有真实协议接口。Dicode 新增的是产品交互（Markdown、高亮、滚动、命令、
Git 状态只读展示）。图片/文件附件依赖 `turn/start.input` 的类型支持，需在 TUI 接入。
