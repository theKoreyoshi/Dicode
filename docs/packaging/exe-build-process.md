# Dicode EXE 构建流程（固化）

## 固定版本

- Node.js（SEA 运行时）：26.13.0（LTS）
- esbuild：0.21.5
- postject：1.0.0-alpha.6
- Dicode：0.1.0

## 构建命令

```powershell
$env:DICODE_SEA_NODE = "path\to\node-v26.13.0-win-x64\node.exe"
node tools/build-exe.mjs
```

构建脚本读取 `DICODE_SEA_NODE` 指定用于 SEA 的 Node 26 二进制，默认使用当前 Node。
开发环境保持 Node 24，不冲突。

## 构建步骤

1. esbuild 打包 CLI+TUI+Core+Adapter 为单个 ESM bundle（format: esm）。
2. banner 注入 createRequire 全局 require shim，替换 react-devtools-core stub。
3. 生成 sea-config.json（mainFormat: module）。
4. node --experimental-sea-config 生成 blob。
5. 复制 Node 26 二进制并注入 blob（postject）。

## 产物

- release/dicode.exe（约 106MB，含 Node 26 运行时 + 业务代码）。
- release/build-info.json（版本信息 + EXE SHA-256 + 构建时间）。

## 重复性与失败处理

构建全程无网络依赖、不依赖 CWD、不依赖开发机全局 Node 版本。任一步骤失败抛异常（非零退出码）。
