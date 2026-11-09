# Codex 原生能力说明

## 模型与推理

- `model/list` 返回 `{ data: [{ id, model, displayName, description,
  supportedReasoningEfforts: [{ reasoningEffort, description }],
  defaultReasoningEffort, ... }] }`。
- 切换模型通过 `thread/start.model` 或 `turn/start.model`。
- 推理等级通过 `turn/start.effort`（值为模型 `supportedReasoningEfforts` 中的
  `reasoningEffort`，例如 `low`/`high`/`max`）。

## 文件变更与 Diff

- `item/fileChange/patchUpdated`：`{ changes, itemId, threadId, turnId }`。
- `turn/diff/updated`：`{ diff, threadId, turnId }`。
- 二者都是真实事件流数据，Dicode 负责展示；文件实际修改由 Runtime 完成。

## MCP / Skills

- MCP：`mcpServerStatus/list`（连接状态）、`mcpServer/*`。
- Skills：`skills/list`（返回 `{ data: [...] }`）。
- Dicode 仅展示，不实现新的 MCP/Skills 执行引擎。

## 附件输入

- `turn/start.input` 的 `UserInput` 支持 `text`、`image`(url/fileId)、
  `localImage`(path)、`localAudio`(path)、`audio`、`skill`、`mention` 类型。
- 图片/文件附件通过 `localImage`/`localAudio`/`skill` 传递真实本地路径。
