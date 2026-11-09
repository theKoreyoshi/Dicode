# Node.js SEA ESM 入口兼容性验证

## 结论

Node.js **26.13.0（LTS）** 的 SEA `mainFormat: "module"`（ESM 入口）**可正常运行**
Dicode 项目。Node.js 24.18.0 仅能生成 ESM blob，但运行时加载 ESM 入口失败。

## 官方依据

- Node.js SEA 通过 `--experimental-sea-config` + `mainFormat: "module"` 支持 ESM 入口。
- Node 26.13.0（LTS "Lithium"，2026-10-28 发布）实测可用。

## 关键配置

1. esbuild 输出 ESM（`format: "esm"`），因 Ink 5 / yoga-layout 使用 top-level await。
2. sea-config.json 增加 `"mainFormat": "module"`。
3. banner 注入 `createRequire(import.meta.url)` 作为全局 `require`，解决 CJS 依赖
   （如 signal-exit）中 `require("assert")` 在 ESM 环境不可用的问题。
4. 将 Ink 的 `react-devtools-core` 用空 stub 替换（仅开发工具用）。

## 版本对照

| Node | mainFormat: module | 运行结果 |
| --- | --- | --- |
| 24.18.0 | 生成 blob 成功 | 运行时 `embedderRunCjs` 失败（ESM 入口未生效）|
| 26.13.0 | 生成 blob 成功 | 运行时 `embedderRunESM` 正常，`ESM_SEA_OK` |
