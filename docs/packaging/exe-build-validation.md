# Dicode 独立 EXE 构建验证报告（阶段 6.1）

## 构建结果：构建成功，独立运行失败

| 项 | 值 |
| --- | --- |
| 产物 | release/dicode.exe |
| 大小 | 98.1 MB |
| Node 运行时 | 已内嵌（复制自 Node 24.18.0）|
| 构建工具 | esbuild 0.21.5 + Node SEA + postject 1.0.0-alpha.6 |

## 构建日志摘要

```
[1/4] bundling with esbuild...         成功
[2/4] writing sea-config.json...       成功
[3/4] generating SEA blob...           Wrote sea-prep.blob
[4/4] injecting blob...                Injection done!（有 signature 警告）
DONE: release/dicode.exe               size: 98.1MB
```

## 运行结果（失败）

`dicode.exe --version` 与 `--help` 均失败：

```
SyntaxError: Cannot use import statement outside a module
    at embedderRunCjs (node:internal/main/embedding:63:7)
```

原因：Node SEA 以 CJS 加载入口，而 esbuild 因 Ink 5/yoga-layout 的 top-level await
只能输出 ESM。

## 区分声明

- 构建成功：已生成 release/dicode.exe。
- 独立运行验证成功：未通过（EXE 无法启动业务代码）。
- 无 Node.js 环境真实运行：未验证。

## 未完成项

- 单文件 EXE 独立运行。
- 无 Node.js 环境验证。
- node:sqlite/Ink/子进程/stdio 在打包产物中的端到端验证。
