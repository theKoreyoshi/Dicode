# Dicode 独立 EXE 技术方案评估（阶段 6.1）

目标：将 Dicode 产品层（CLI + TUI + Core + Adapter）构建为 Windows x64 独立 EXE，
用户无需安装 Node.js。Codex Runtime 仍作为独立文件在 runtime/codex/ 下。

关键技术约束：

- node:sqlite：Node 22+ 内置原生模块（打包器必须使用真实 Node 22+ 运行时）。
- Ink 5 + React 18 + yoga-layout。
- 子进程 spawn、stdio 双向 JSON-RPC、Markdown/代码高亮。

## 方案评估

| 方案 | Node 版本 | node:sqlite | top-level await | 结论 |
| --- | --- | --- | --- | --- |
| Node.js SEA | 真实 Node 24 | 支持 | 仅 CJS，不支持 top-level await | 打包成功但运行失败 |
| pkg（vercel）| 旧 Node | 不支持 | 不支持 ESM | 不可用 |
| @yao-pkg/pkg | 旧 Node | 不支持 | 不支持 ESM | 不可用 |
| nexe | 旧 Node | 不支持 | 不支持 ESM | 不可用 |
| Bun compile | Bun 运行时 | 无 node:sqlite | 部分 | 需改造存储层 |

## 核心发现（真实验证）

1. esbuild 打包 Ink 5 时，yoga-layout 含 `const Yoga = wrapAssembly(await loadYoga())`
   （top-level await），Ink reconciler.js 含 `await import('./devtools.js')`。
2. 因此无法输出 CommonJS（esbuild 报「Top-level await 不支持 cjs」）。
3. 改为 ESM 后 SEA 构建成功（release/dicode.exe，98.1MB），但运行时报
   `embedderRunCjs: Cannot use import statement outside a module`——Node 24.18.0 的
   SEA 将入口按 CJS 加载，无法执行 ESM 的 top-level await。

## 结论

当前 Ink 5 + Node 24 技术栈下，没有成熟可靠的方案能生成真正的单文件独立 EXE：SEA
受限于「ESM top-level await」与「CJS 入口」的矛盾，pkg/nexe 不支持 Node 22+ 与
node:sqlite。此结论有真实构建与运行日志作为证据。

可选出路（需另行决策）：

1. 改用不支持 top-level await 的 TUI 渲染方案（较大改造）。
2. 放弃单文件，采用「内置 Node 运行时 + node_modules 目录」的便携目录交付。
3. 等待 Node SEA 完善 ESM 支持。
