# 阶段 5 实施计划

## 范围

- P0：Markdown/代码高亮、消息滚动(基础)、Slash Commands、模型/推理选择、
  文件变更/Diff/Git 展示、真实工作流测试。
- P1：MCP/Skills 展示、附件输入、配置展示。

## 顺序

1. 能力盘点（本文件 + codex-feature-matrix.md）。
2. Adapter/Core 增加 `model/list` 与模型/推理透传。
3. Slash Commands 注册与执行。
4. Markdown 渲染 + 代码高亮。
5. Git 只读状态 + 文件变更/Diff 展示。
6. 回归 + 真实 Agent 工作流测试。

## 约束

- 所有 Agent 功能以 Codex 原生接口为准，不自行扩展 Runtime。
- Git 仅只读展示，不执行破坏性操作。
- 不开发 Multi-Agent、自定义编排、记忆系统。
