# Dicode — 企业级 Windows Code Agent CLI 产品开发总规范

你是一名资深 AI Agent 基础设施工程师、TypeScript 架构师、终端 UI 设计师和 Windows 软件工程师。

现在需要从零开发一款名为 **Dicode** 的企业级 Windows Code Agent CLI 产品。

本项目不是一个简单的 Codex 命令包装器，而是一款具有独立品牌、独立 TUI 界面、独立会话管理、完整 Agent 交互能力和 Windows 安装部署能力的产品级 Coding CLI。

你的任务是实际完成项目开发、代码编写、测试、构建和打包，而不是只输出设计方案。

---

# 一、项目核心定位

## 1.1 产品目标

开发一款独立的 Windows Code Agent CLI，产品名称为 Dicode。

核心设计：

- 使用官方 Codex CLI / codex.exe 作为底层 Agent 执行引擎。
- 不修改 Codex.exe，不重新实现 Codex Agent Runtime。
- 通过 Codex App Server 实现与 Codex 的双向通信。
- 自主开发 Dicode 的 CLI 入口、TUI 界面、会话管理、交互逻辑和业务层。
- 参考 OpenCode 的 CLI 产品形态和交互设计。
- 尽可能复现 Codex CLI 的功能及使用体验。
- 最终打包成可以在其他 Windows 电脑直接安装使用的软件。

最终用户使用方式：

```powershell
PS C:\Users\User> dicode
```

执行后直接进入 Dicode 自己的终端交互界面。

不能直接进入 Codex CLI 原生界面。
不能仅在 CMD 中输出简单的文字菜单。
不能要求用户通过 codex 命令操作。
不能要求目标电脑预装 Node.js、Python 等开发环境。

## 1.2 核心架构原则

必须严格遵守：

1. Codex Runtime 是 Agent 核心。
2. Dicode 是独立客户端产品。
3. 所有 Agent 操作通过 Codex App Server。
4. 使用 JSON-RPC over stdio 通信。
5. UI 不允许直接调用 codex.exe。
6. Core 不允许依赖具体 UI 实现。
7. Codex Adapter 不允许自行实现 Agent 推理。
8. 不得伪造 App Server API。
9. 不得通过模拟数据伪装功能已经完成。
10. 所有能力以当前实际 Codex App Server Schema 为准。

---

# 二、技术架构

采用模块化 Monorepo 架构。

推荐技术栈：

- TypeScript
- Node.js
- React
- Ink 或 OpenTUI（先验证 Windows 兼容性，择优确定）
- Zod
- SQLite
- Vitest
- WiX Toolset

如果发现推荐技术存在明显兼容性问题，可以提出替代方案，但必须先验证再决定。

## 2.1 整体架构

```text
              Windows Terminal
               PowerShell / CMD
                       |
                       v
                 Dicode.exe
                       |
                       v
                 CLI Router
                       |
                       v
                 Dicode TUI
                       |
                       v
                Application Core
                       |
             +---------+---------+
             |                   |
             v                   v
        Session Manager     Event Manager
             |                   |
             +---------+---------+
                       |
                       v
                 Codex Adapter
                       |
                       v
               JSON-RPC Client
                       |
                       v
                codex.exe
                app-server
                       |
                       v
                Codex Runtime
                       |
          +------------+------------+
          |            |            |
          v            v            v
       LLM推理       工具调用      文件操作
          |            |            |
          +------------+------------+
                       |
                       v
                  执行结果
                       |
                       v
                 Dicode TUI
```

## 2.2 模块职责

CLI：
- 解析命令和参数。
- 管理程序入口。
- 启动 TUI。
- 处理版本、帮助、诊断等命令。

TUI：
- 欢迎页面。
- 多轮对话。
- 工具调用显示。
- Diff 展示。
- 权限审批。
- Settings 页面。
- 快捷键和交互控制。

Core：
- 会话管理。
- 任务管理。
- 状态管理。
- 事件分发。
- 配置管理。
- 数据持久化。

Codex Adapter：
- Codex 进程管理。
- App Server 初始化。
- JSON-RPC 通信。
- API 请求管理。
- 事件转换。
- 审批消息处理。

Shared：
- 通用类型。
- 常量。
- 工具函数。
- 统一错误定义。

---

# 三、Codex App Server 接入

这是整个项目的核心技术部分。

必须优先研究当前安装的 Codex 版本以及官方 App Server 文档。

官方参考：

https://github.com/openai/codex

https://developers.openai.com/codex/app-server/

https://github.com/openai/codex/tree/main/codex-rs/app-server

## 3.1 启动方式

通过以下方式启动 Codex App Server：

```powershell
codex app-server --listen stdio://
```

必须使用子进程管理。

要求：

- 自动定位 codex.exe。
- 启动 App Server。
- 管理 stdin、stdout、stderr。
- 正确处理 JSON-RPC 消息。
- 防止普通日志污染 stdout 协议通道。
- 支持异常退出检测。
- 支持进程优雅关闭。
- 支持请求超时。
- 支持请求 ID 管理。
- 支持多个并发请求。
- 处理进程崩溃和连接断开。

不要直接在 TUI 内启动 Codex 原生交互界面。

## 3.2 JSON-RPC 通信

实现完整 JSON-RPC Client：

- 请求序列化。
- 响应反序列化。
- Request ID。
- Promise 请求关联。
- 超时管理。
- 错误处理。
- Notification 处理。
- Server Request 处理。
- 并发请求管理。
- 进程异常断开处理。

初始化顺序必须遵循当前协议：

```text
启动 App Server
      |
      v
接收协议消息
      |
      v
initialize
      |
      v
initialized
      |
      v
获取必要能力
      |
      v
允许创建会话
```

协议参数必须以实际 Schema 为准。

## 3.3 必须研究和适配的接口

优先检查并适配：

- initialize
- thread/start
- thread/resume
- thread/list
- thread/fork
- thread/archive
- turn/start
- turn/steer
- turn/interrupt
- model/list
- account/read
- command/exec

注意：上面是功能调查清单，不代表所有方法在所有版本中都存在。必须先核对实际协议，禁止直接假定接口可用。

## 3.4 实时事件处理

必须实现统一事件处理机制。

重点包括：

- Turn 开始和结束。
- Agent 消息增量输出。
- Item 开始和结束。
- 工具调用。
- Shell 执行。
- Shell 输出。
- 文件读取。
- 文件修改。
- 命令执行结果。
- 权限审批请求。
- Diff 相关事件。
- Agent 错误。
- 中断事件。

建立统一事件结构：

```typescript
interface DicodeEvent {
  type: string;
  sessionId?: string;
  turnId?: string;
  itemId?: string;
  timestamp: number;
  payload: unknown;
}
```

将 Codex 原始事件映射为 Dicode 内部事件。

UI 只消费 Dicode 统一事件，不直接处理原始 JSON-RPC 数据。

## 3.5 Agent 审批机制

必须完整处理 App Server 发出的审批请求。

流程：

```text
Agent 请求执行操作
        |
        v
App Server 发送审批请求
        |
        v
Dicode 接收事件
        |
        v
UI 展示审批界面
        |
        v
用户批准或拒绝
        |
        v
Dicode 返回协议响应
        |
        v
Agent 继续或终止操作
```

不能将审批事件当作普通聊天消息。

不能默认自动批准所有操作。

必须尊重 Codex 原有的 Sandbox 和权限策略。

---

# 四、Dicode UI 设计规范

这是产品的重要组成部分。

整体参考 OpenCode CLI 的布局和交互方式，结合 Dicode 自己的蓝色像素风品牌。

OpenCode 参考：

https://github.com/anomalyco/opencode

注意：参考其 UI 设计和交互逻辑，不直接复用其 Agent Runtime。

## 4.1 视觉风格

产品名称：Dicode

品牌定位：

AI Coding Agent for Developers

核心视觉：

- 深蓝黑色背景。
- 蓝色作为主色调。
- 青蓝色作为辅助高亮。
- 灰蓝色作为次级文字。
- 像素风 Logo。
- 适当使用复古终端视觉元素。
- 使用清晰的等宽字体。
- 界面简洁、专业、现代。
- 不要过度使用像素元素。
- 不要做成传统 CMD 菜单。
- 不要做成普通聊天机器人界面。

建议颜色：

```text
背景色：#080E1C
主背景：#0D1629
次级背景：#111F38
主蓝色：#258BFF
辅助蓝：#43C7FF
文字：#E1EAF8
次级文字：#91A8C9
边框：#263D61
成功：#35C98A
警告：#E9B65B
错误：#F16B78
```

建议字体：

- Cascadia Code
- Cascadia Mono
- JetBrains Mono
- Consolas

根据目标终端可用字体进行降级。

## 4.2 Logo 设计

Dicode 需要独立 Logo。

建议使用：

- 像素风几何图形。
- 蓝色渐变视觉。
- 具有代码执行、箭头、终端的设计意象。
- Logo 与 Dicode 文字组合。

Logo 必须能够在 TUI 中使用，优先采用兼容终端的字符图形或 ANSI 颜色绘制。

## 4.3 Welcome 首页

参考 OpenCode 首页设计。

页面结构：

```text
┌──────────────────────────────────────────────┐
│ Dicode                              v1.0.0   │
├──────────────────────────────────────────────┤
│                                              │
│         DICODE LOGO                          │
│                                              │
│             Welcome to Dicode!               │
│       Your AI Coding Agent in Terminal       │
│                                              │
├─────────────────────┬────────────────────────┤
│ Recent Sessions     │ What can Dicode do?    │
│                     │                        │
│ > project-a         │  Understand project    │
│   project-b         │  Write and modify code │
│   project-c         │  Execute commands      │
│                     │  Run tests             │
│                     │  Review code changes   │
│                     │                        │
│ Open Project        │                        │
│ New Session         │                        │
├─────────────────────┴────────────────────────┤
│ > Ask Dicode anything...                     │
├──────────────────────────────────────────────┤
│ Model | Project | Permission | Shortcuts     │
└──────────────────────────────────────────────┘
```

首页必须支持：

- 新建会话。
- 打开项目。
- 最近会话。
- 恢复历史会话。
- 查看当前项目。
- 查看当前模型。
- 查看 Agent 状态。
- 快速输入任务。
- 快捷键提示。

## 4.4 Chat 对话页面

要求：

1. 多轮对话。
2. 实时流式输出。
3. Markdown 渲染。
4. 代码块高亮。
5. 代码块复制。
6. 用户消息。
7. Agent 消息。
8. 工具调用展示。
9. 执行状态展示。
10. 多行输入。
11. 文件和上下文引用。
12. 中断任务。
13. 追加指令。
14. 历史消息滚动。

页面示意：

```text
┌──────────────────────────────────────────────┐
│ Dicode | project-a | Model | Agent          │
├──────────────────────────────────────────────┤
│                                              │
│ You                                          │
│ 分析当前项目结构并优化代码。                 │
│                                              │
│ Dicode                                       │
│ 正在分析项目结构...                           │
│                                              │
│ ✓ Scanning project files                     │
│ ✓ Reading package.json                       │
│ ● Analyzing dependencies                      │
│                                              │
│ ┌──────────────────────────────────────────┐ │
│ │ Tool: Terminal                           │ │
│ │ npm run test                             │ │
│ │ Running...                               │ │
│ └──────────────────────────────────────────┘ │
│                                              │
├──────────────────────────────────────────────┤
│ > 输入消息...                                │
├──────────────────────────────────────────────┤
│ Ctrl+C Interrupt | Enter Send | Tab Mode    │
└──────────────────────────────────────────────┘
```

## 4.5 Tool 执行展示

必须区分不同工具：

- Shell。
- 文件读取。
- 文件修改。
- 文件创建。
- 测试执行。
- MCP。
- Skills。
- Agent 委派。

每个工具卡片展示：

- 工具名称。
- 执行参数。
- 执行状态。
- 实时输出。
- 执行结果。
- 耗时。
- 错误信息。

工具执行期间允许折叠和展开。

不能将所有工具输出混合在普通聊天文本中。

## 4.6 Diff 页面

实现：

- 修改文件列表。
- 新增文件。
- 删除文件。
- 修改文件。
- Unified Diff。
- 行号。
- 添加行和删除行高亮。
- 文件变更统计。
- Git 状态。
- 修改前后内容对比。

必须使用真实的文件变更数据。

## 4.7 Approval 页面

实现：

- 命令审批。
- 文件操作审批。
- 权限模式显示。
- 确认。
- 拒绝。
- 返回执行状态。

清晰展示 Agent 请求执行的具体操作。

## 4.8 Settings 页面

支持：

- 模型查看与切换。
- 推理级别。
- 当前项目路径。
- 权限模式。
- Sandbox 配置。
- MCP Server 管理。
- Skills 管理。
- 主题设置。
- 快捷键说明。
- Runtime 版本信息。

## 4.9 CLI 交互要求

支持：

- Enter 发送消息。
- Shift+Enter 换行。
- Ctrl+C 中断任务。
- Esc 关闭弹窗或退出当前操作。
- 上下方向键导航。
- Tab 切换输入模式或选项。
- 快捷键命令面板。
- 终端尺寸自适应。
- 滚动历史消息。
- 终端退出恢复。

---

# 五、Dicode 功能对齐要求

目标是尽可能实现与 Codex CLI 相同的用户使用能力。

## P0：核心功能

- 启动 Dicode TUI。
- 新建会话。
- 多轮对话。
- 实时流式输出。
- 恢复会话。
- 历史会话。
- 追加指令。
- 中断任务。
- Agent 工具调用。
- Shell 命令执行。
- 文件读取和修改。
- 权限审批。
- Diff 展示。
- Markdown 和代码高亮。
- 项目目录管理。
- 错误处理。

## P1：高级功能

- 模型切换。
- 推理级别切换。
- MCP 管理。
- Skills 加载和调用。
- Plan 模式。
- Git 状态。
- 代码 Review。
- 会话 Fork。
- 会话归档。
- 上下文管理。
- 多会话切换。
- 配置管理。
- 命令面板。

## P2：扩展功能

- Multi-Agent。
- 子 Agent 状态展示。
- 并行任务。
- 更完善的代码审查。
- 自动化测试工作流。
- 插件扩展机制。

所有功能必须优先检查 App Server 是否提供原生能力。

无法原生支持的功能必须明确说明，不能伪装成已完成。

---

# 六、项目工程结构

建议采用以下结构：

```text
dicode/
│
├── packages/
│   ├── cli/
│   │   └── src/
│   │       ├── index.ts
│   │       ├── router.ts
│   │       └── commands/
│   │
│   ├── tui/
│   │   └── src/
│   │       ├── app.tsx
│   │       ├── screens/
│   │       │   ├── Welcome.tsx
│   │       │   ├── Chat.tsx
│   │       │   ├── Settings.tsx
│   │       │   └── DiffViewer.tsx
│   │       ├── components/
│   │       ├── hooks/
│   │       └── theme/
│   │
│   ├── core/
│   │   └── src/
│   │       ├── session/
│   │       ├── task/
│   │       ├── event/
│   │       ├── approval/
│   │       ├── config/
│   │       └── storage/
│   │
│   ├── codex-adapter/
│   │   └── src/
│   │       ├── process-manager.ts
│   │       ├── jsonrpc-client.ts
│   │       ├── protocol.ts
│   │       ├── event-mapper.ts
│   │       └── methods/
│   │
│   └── shared/
│       ├── types/
│       ├── constants/
│       └── utils/
│
├── schemas/
│   └── codex-app-server/
│
├── runtime/
│   └── codex/
│
├── installer/
│   ├── wix/
│   └── scripts/
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── docs/
│   ├── architecture.md
│   ├── protocol.md
│   ├── feature-parity.md
│   ├── installation.md
│   └── development.md
│
├── AGENTS.md
├── package.json
├── tsconfig.json
└── README.md
```

允许根据实际技术选型调整，但必须保持模块职责清晰。

---

# 七、Windows 打包与部署

最终目标是生成可以独立安装的 Windows x64 产品。

## 7.1 安装包

目标文件：

```text
Dicode-Setup-x64.msi
Dicode-Portable-x64.zip
```

推荐：

- Node.js 编译或独立可执行文件打包。
- WiX Toolset。
- 内置 Codex Runtime。
- 固定 Codex Runtime 版本。
- 内置必要资源。

打包之前必须核查 Codex Runtime 及其依赖的许可证和分发条件。

## 7.2 安装目录

```text
Dicode/
│
├── Dicode.exe
│
├── runtime/
│   └── codex.exe
│
├── resources/
│   ├── logo/
│   └── themes/
│
└── uninstall.exe
```

实际生产目录可以根据打包方案调整。

## 7.3 用户数据

统一存储在：

```text
%APPDATA%\Dicode\
│
├── config/
├── sessions/
├── logs/
└── cache/
```

项目配置：

```text
project/
└── .dicode/
    └── config.json
```

不能把用户数据写入安装目录。

不能覆盖用户原有 Codex 配置。

## 7.4 安装功能

MSI 安装过程：

1. 安装 Dicode。
2. 部署 Codex Runtime。
3. 创建用户配置目录。
4. 创建默认配置。
5. 配置 PATH。
6. 创建开始菜单入口。
7. 检查 Runtime。
8. 完成安装。

## 7.5 启动行为

必须支持：

```powershell
dicode
dicode --version
dicode --help
dicode doctor
dicode config
dicode resume
dicode mcp
dicode skills
```

具体功能必须真实实现。

输入 dicode 后直接进入 Dicode TUI。

如果没有可用的 Codex Runtime 或认证状态，应展示清晰的引导和诊断信息，而不是直接崩溃。

## 7.6 兼容性

测试：

- Windows 10 x64。
- Windows 11 x64。
- CMD。
- PowerShell 5.1。
- PowerShell 7。
- Windows Terminal。

必须测试中文路径、空格路径、权限、终端缩放、Ctrl+C、子进程退出和异常恢复。

---

# 八、开发实施步骤

不要一次性生成整个项目。

必须分阶段执行，每个阶段都要求真实代码、测试和交付。

## 阶段 1：环境检查与工程初始化

任务：

1. 检查 Node.js。
2. 检查 npm。
3. 检查 Git。
4. 检查 Codex Runtime。
5. 检查 App Server 是否可以启动。
6. 确认协议 Schema。
7. 创建 Monorepo。
8. 创建基础工程文件。
9. 建立 AGENTS.md。
10. 建立架构文档。

交付：

可运行的最小工程。

## 阶段 2：Codex Adapter

任务：

1. Process Manager。
2. JSON-RPC Client。
3. 协议握手。
4. Thread 管理。
5. Turn 管理。
6. 实时事件接收。
7. 审批处理。
8. 进程异常处理。

验收：

通过 Dicode Adapter 启动 Codex App Server，完成真实任务并收到完整执行事件。

## 阶段 3：Core

任务：

1. Session Manager。
2. Task Manager。
3. Event Manager。
4. Approval Manager。
5. Config Manager。
6. SQLite Storage。

验收：

Core 能够完整管理会话和 Agent 执行状态，不依赖 TUI。

## 阶段 4：TUI

按顺序实现：

1. Welcome。
2. Chat。
3. Tool。
4. Approval。
5. Diff。
6. Settings。

验收：

所有界面真实接入 Core 和 Codex Adapter。

## 阶段 5：功能对齐

逐项完成 P0、P1 功能。

为每项功能建立对齐表：

- App Server 是否支持。
- Adapter 是否实现。
- Core 是否实现。
- UI 是否实现。
- 是否通过集成测试。

## 阶段 6：Windows 产品化

任务：

1. 构建 Dicode.exe。
2. 部署 Codex Runtime。
3. 生成默认配置。
4. 生成 MSI。
5. 配置 PATH。
6. 实现卸载。
7. 实现诊断。
8. 实现版本管理。

## 阶段 7：测试和验收

必须在干净 Windows 虚拟机中安装。

测试：

- 安装。
- 启动。
- 创建任务。
- 实时输出。
- 工具调用。
- 权限审批。
- 文件修改。
- Diff。
- 会话恢复。
- 中断。
- 异常退出。
- 卸载。

---

# 九、测试与质量要求

必须使用：

- Vitest：单元测试。
- Integration Test：App Server 真实集成测试。
- E2E：完整 CLI 交互测试。

特别关注：

1. JSON-RPC 并发请求。
2. 消息流不完整。
3. 子进程异常退出。
4. Agent 中断。
5. 审批超时。
6. 大量终端输出。
7. 终端尺寸变化。
8. 中文文件路径。
9. 会话恢复。
10. Runtime 版本不兼容。

所有重要功能必须有真实测试。

不能使用 Mock 测试代替所有真实集成测试。

---

# 十、项目开发规则

请在项目根目录建立 AGENTS.md，并将以下规则作为长期约束：

1. 不修改 Codex Runtime。
2. 不重新实现 Agent 核心。
3. 不绕过 App Server。
4. 不假设不存在的协议 API。
5. 不伪造 Agent 事件。
6. 不自动批准危险操作。
7. 不将 Token 或凭证写入日志。
8. 不将 UI 与 Adapter 耦合。
9. 不将用户数据存入安装目录。
10. 所有代码必须通过 TypeScript 类型检查。
11. 所有核心模块必须有测试。
12. 所有 Windows 功能必须真实验证。
13. 不允许只生成静态页面。
14. 不允许用 TODO 代替核心功能。
15. 每个阶段必须实际运行和验收。

如果遇到协议不支持的功能，必须记录限制和替代方案，不得虚构实现。

---

# 十一、最终交付目标

最终交付一款真正可以使用的 Dicode Windows CLI 产品。

预期成果：

```text
Dicode/
│
├── Dicode-Setup-x64.msi
├── Dicode-Portable-x64.zip
│
├── source/
│
├── docs/
│   ├── architecture.md
│   ├── installation.md
│   ├── user-guide.md
│   ├── protocol.md
│   └── test-report.md
│
└── README.md
```

最终验收：

1. 其他 Windows 电脑可以直接安装。
2. 不要求预装 Node.js 或 Python。
3. 安装后输入 dicode 即可启动。
4. 显示独立的 Dicode TUI。
5. 可以连接 Codex App Server。
6. 可以正常执行真实 Coding 任务。
7. 可以实时展示 Agent 执行过程。
8. 可以调用工具和执行命令。
9. 可以进行权限审批。
10. 可以查看文件变更和 Diff。
11. 可以恢复历史会话。
12. 具有完整的错误处理和日志系统。

最终目标不是一个 UI Demo，而是一款真正可交付、可安装、可运行、可扩展的企业级 Code Agent CLI。

---

# 十二、现在立即开始执行

不要只回复架构方案。

请直接检查当前工作目录和开发环境，然后开始项目开发。

执行顺序：

第一步：环境检查与 Codex App Server 技术验证。

第二步：建立完整工程骨架。

第三步：完成 Codex Adapter 的真实通信。

第四步：完成 Core。

第五步：开发 Dicode TUI。

第六步：逐项实现功能对齐。

第七步：Windows 打包。

每完成一个阶段：

- 输出已完成内容。
- 输出修改的文件。
- 运行测试。
- 报告测试结果。
- 列出未完成内容。
- 更新项目文档。

遇到技术决策时，优先选择可靠、稳定、可维护且兼容 Windows 的方案。

请开始执行，并持续推进到最终可交付产品。