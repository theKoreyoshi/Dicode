# Dicode SEA ESM 构建与运行验证报告

## 构建产物

| 项 | 值 |
| --- | --- |
| 产物 | release/dicode.exe |
| 大小 | 105.7 MB |
| Node 运行时 | Node 26.13.0（内嵌）|
| 格式 | ESM SEA（mainFormat: module）|
| 构建工具 | esbuild + Node SEA + postject |

## 真实运行结果（全部通过）

| 验证项 | 结果 |
| --- | --- |
| dicode.exe --version | 输出 Dicode 0.1.0 |
| dicode.exe --help | 正常输出帮助 |
| SQLite（node:sqlite）| OK（doctor 检查通过）|
| 子进程启动 codex.exe | OK（App Server 启动）|
| JSON-RPC 握手 | OK（initialize）|
| 模型列表 model/list | OK |
| TUI 渲染 | 正常进入 Welcome（Logo/项目/Quick Start）|
| 退出清理 | 冒烟测试强制终止，未验证优雅退出 |

## 未完成项

- 无 Node.js 环境真实运行（本环境有 Node，但 SEA 已内嵌 Node 26，运行不依赖外部 node）。
- 优雅退出与子进程清理的自动化验证。
- 中文路径/空格路径的打包后验证。
