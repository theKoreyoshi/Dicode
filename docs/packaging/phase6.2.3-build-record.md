# 完整安装包构建记录

## Dicode EXE

- 版本：0.1.0
- Node：v26.13.0（SEA ESM）
- 大小：105,710,080 字节
- SHA-256：f0190ac57ac8f83a6170da71dd4f23f9a5e04ded45d3125ea95b51ebbb92ae04
- esbuild：0.21.5 / postject：1.0.0-alpha.6

## 完整安装包

- 文件：release/Dicode-Setup-x64.exe
- 大小：105.5 MB
- SHA-256：82551fbf58bd9ed0d7f27eeae14fb91e4172b455bb04a347701602b89b96bcd8
- 内容：dicode.exe + runtime/codex/codex.exe + resources + version.json
- 安装程序：Inno Setup 6.7.4

## Codex Runtime

- 版本：0.167.0
- SHA-256：edfdd48f8b458af0906e507b4cb05217b326c3d6e515e9f024e05e3b8d650f70

## 2026-11-11 TUI 发布构建

- 内容：OpenCode 风格 transcript、左侧项目/会话栏、实时消息阶段和完整工具输入/输出展示。
- Node SEA：v26.13.0；esbuild：0.21.5；postject：1.0.0-alpha.6。
- `release/dicode.exe`：105,823,744 字节；SHA-256：`38da2aae815e75ce5a94c55af22a1af2540b1de4415c152434dd94f25f8e7268`。
- `release/Dicode-Setup-x64.exe`：157,106,749 字节；SHA-256：`dad864aa698784a7404f0fc34e66141b6cff11780fffd1f8176c3f18ddafca4b`。
- `release/Dicode-Portable-x64.zip`：233,361,166 字节；SHA-256：`c2a547ac1466dd096603e0bfd7a3e0b57df4a13f32fe0ed0812608d1497ef8f4`。
- 验证：EXE `--version` / `--help`；Setup 临时安装、已安装版 `doctor` 与卸载；doctor 确认 Codex 0.167.0 七个 runtime 文件、App Server `initialize` + `model/list`、认证和 SQLite 均正常。
- 质量检查：类型检查、Lint、28 个单元测试（159 项）通过。

## 2026-11-11 OpenCode 风格 TUI 构建

- 内容：左侧会话标签栏、中间转录、宽屏右侧 42 列上下文面板；命令选择器改为工作区弹层；连续工具调用按 turn 折叠为 Activity；支持 Ctrl+Tab 会话切换。
- OpenCode 对照：只读参考 `anomalyco/opencode` commit `d4ea024`，未复制其组件或 Runtime。
- SEA：Node.js 26.13.0；esbuild 0.21.5；postject 1.0.0-alpha.6。
- 固定 Codex 0.167.0 运行时使用仓库现有发行目录，并通过 `runtime/codex/version.json` 的逐文件 SHA-256 校验。
- 发布目录：`release/Dicode-OpenCode-TUI-20261111/`；隔离构建和验证目录保留在 `release/opencode-tui-20261111/`。
- `dicode.exe`：105,831,936 字节；SHA-256：`be6851d22af658ea598ecab941988ab5b19357523bd90b2569234cc6e52b4979`。
- `Dicode-Setup-x64.exe`：157,127,111 字节；SHA-256：`18ec8f39082fb8e3dbaa9baec2942852630e0f276f4e71258ddbec0c7afe683c`。
- `Dicode-Portable-x64.zip`：233,362,526 字节；SHA-256：`06467d3356703471e4c82207f61eeec985c6e2bf9fc6dd8cef4110483f9a4fe8`。
- 验证：类型检查、Lint、28 个测试文件（161 项）通过；打包 EXE 的 `--version` / `--help` 通过；安装器临时安装后 `doctor` 检查项全部通过（Runtime、App Server initialize/model/list、认证、SQLite），但该次 doctor 进程输出报告后未自行退出，已终止测试进程并卸载；便携 ZIP 内 EXE 与构建文件 SHA 一致。
- 分发状态：该构建用于企业内部验证；正式外部分发仍遵循已有 Runtime 许可证审核结论。

## 2026-11-11 OpenCode 截图对齐版

- TUI：移除会话页顶部 Header 和常驻左侧会话栏；会话页改为转录区、右侧 Context 面板、嵌入式 composer/footer。首页采用居中品牌和共享 composer；`/` 补全显示在 composer 上方，以命令和描述两列呈现。
- 执行过程：Thought 只显示 App Server 生命周期时间计算出的耗时；reasoning 正文不进入 Core 事件或存储。工具输入、输出、退出码和耗时继续来自真实 Codex 事件。
- Runtime：使用上一构建便携包中的 Codex 0.167.0 解压目录，并对固定清单中的 7 个文件逐一验证 SHA-256；`tools/package-windows.mjs` 现在同时接受经逐文件验证的 Runtime 目录和固定 SHA 的官方归档。
- 输出目录：`release/Dicode-OpenCode-Refined-20261111/`。
- Node SEA：v26.13.0；esbuild 0.21.5；postject 1.0.0-alpha.6。
- `dicode.exe`：105,832,448 字节；SHA-256：`96cac0a771fdccd28ad049aaccfb978fceac41a0101668609032e904faaef883`。
- `Dicode-Setup-x64.exe`：157,076,282 字节；SHA-256：`674b4b083a3f9e6e1fe2e82e20751d94b8d2f68899dd01138d4b2db1fb2cb14f`。
- `Dicode-Portable-x64.zip`：233,362,753 字节；SHA-256：`3787fb41b1b6c9feda658ed9cc8a758af9d16ea2accc0084570e64623a067e01`。
- 验证：类型检查、Lint、28 个测试文件（164 项）通过；独立 EXE 与 ZIP 解出的 EXE SHA-256 一致；两者的 `--version` / `--help` 均通过；Inno Setup 编译成功。此轮未做安装器安装及真实模型调用测试。
- 分发状态：企业内部验证包；Codex Runtime 正式外部分发仍需完成许可证确认。

## 2026-11-11 OpenCode 交互细节对齐版

- TUI：composer 与已发送问题统一使用左侧 `┃` 竖线；运行 footer 显示单字符 spinner、当前活动和 `esc interrupt`；工具调用默认缩进显示类别计数，`/tools` 展开真实参数和输出。
- OpenCode 对照：参考 `anomalyco/opencode` 的 Prompt 左边框、忙碌 footer、活动摘要和 `InlineToolRow`；未复用 OpenCode Runtime。
- 发布目录：`release/Dicode-OpenCode-Matched-20261111/`。
- Node SEA：v26.13.0；esbuild：0.21.5；postject：1.0.0-alpha.6；Codex Runtime：0.167.0，固定七文件摘要校验通过。
- `dicode.exe`：105,833,984 字节；SHA-256：`23159308af68d69ff3f4e48015323c5399b443dae63f149acdbfafb16d93433d`。
- `Dicode-Setup-x64.exe`：157,097,784 字节；SHA-256：`01b1170996b784b5a1438a53f59b4277dbc5ba873d99a69240ea5f115baeb600`。
- `Dicode-Portable-x64.zip`：233,363,048 字节；SHA-256：`8230ee788ef0942b2f60e9e5d4a4e3e9183220d72be70b6f6c70f82db2fa050e`。
- 验证：类型检查、Lint、28 个测试文件（165 项）通过；定向 TUI 测试 21 项通过；独立 EXE `--version` / `--help` 通过；便携 ZIP 中 EXE 与独立版和构建记录 SHA-256 一致；Inno Setup 编译成功。
- 分发状态：企业内部验证包；Codex Runtime 正式外部分发仍需完成许可证确认。

## 2026-11-12 Dicode 身份、上下文用量与权限模式

- 系统指令：新建和恢复的 App Server thread 都注入 Dicode developer instructions，明确 Dicode 是助手产品身份，Codex App Server 是执行 Runtime。
- 上下文：改读 Schema `ThreadTokenUsage.last.totalTokens` 作为当前活跃上下文，百分比采用 Codex 0.167.0 的 12,000-token baseline；不再将累计会话 `total.totalTokens` 除以 context window。
- 权限：新增 `/permissions` 与持久化配置。`Codex default` 沿用原配置；`Allow all · danger-full-access` 在后续 `turn/start` 使用 Schema 支持的 `sandboxPolicy: dangerFullAccess` 和 `approvalPolicy: never`，UI 明示高风险。
- 发布目录：`release/Dicode-Dicode-Identity-Permissions-20261112/`。
- Node SEA：v26.13.0；esbuild：0.21.5；postject：1.0.0-alpha.6；Codex Runtime：0.167.0，固定七文件摘要校验通过。
- `dicode.exe`：105,837,568 字节；SHA-256：`4eca7b0342641b5e96939a9512dd3b05dde924cd3887080735d956515c10f0bb`。
- `Dicode-Setup-x64.exe`：157,108,992 字节；SHA-256：`90730773829194501c8f03fea6fa09d532088ffa1752b95b123517c00c3b07f7`。
- `Dicode-Portable-x64.zip`：233,364,020 字节；SHA-256：`b7b11a76b7382687d3f61b4b70e19312e9c06bf7886cad883352c0c2922762a5`。
- 验证：类型检查、Lint、29 个测试文件（174 项）通过；单 worker 全量测试通过；安装器编译成功；独立 EXE `--version` / `--help` 通过；ZIP 内 EXE 与独立版和构建记录摘要一致。
- 分发状态：企业内部验证包；Codex Runtime 正式外部分发仍需完成许可证确认。
