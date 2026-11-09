# 打包策略比较

## 方案 1：Node 26 ESM SEA 单文件 EXE（已验证可行）

- 单个 EXE（105.7MB，含 Node 26 运行时 + 全部业务代码）。
- Codex Runtime 仍作为独立目录 `runtime/codex/` 随包分发。
- 优点：单文件、无 node_modules、启动简单。
- 缺点：SEA 为实验特性，有 ExperimentalWarning；体积约 106MB。

## 方案 2：便携式目录（备选，未实现）

```
Dicode/
  dicode.cmd
  node/node.exe
  app/dist/ + node_modules/
  runtime/codex/
  resources/
```

- 通过 `dicode.cmd` 调用内置 `node/node.exe app/dist/index.js`。
- 优点：无 SEA 实验限制，兼容性最好。
- 缺点：目录散乱、node_modules 体积大、需维护启动脚本。

## 结论与建议

**方案 1 已通过真实构建与运行验证**，建议采用 Node 26 ESM SEA 单文件 EXE 路线。
正式发布前需：确认 SEA 实验特性的稳定性、补充无 Node 环境与优雅退出测试。
