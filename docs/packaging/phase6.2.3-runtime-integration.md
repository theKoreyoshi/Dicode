# Codex 0.167.0 稳定版 Runtime 集成

## 集成结果

| 项 | 值 |
| --- | --- |
| Runtime 版本 | codex-cli 0.167.0（稳定）|
| 主程序 | runtime/codex/codex.exe（352MB）|
| SHA-256 | edfdd48f8b458af0906e507b4cb05217b326c3d6e515e9f024e05e3b8d650f70 |
| 启动方式 | 保留 `codex app-server --listen stdio://`（未改 Adapter）|
| 伴生文件 | 未额外下载（App Server 核心能力仅需 codex.exe）|

## Runtime 目录

```text
runtime/codex/
  codex.exe
  version.json
  README.md
```

## version.json

记录 codexVersion=0.167.0、platform=windows-x64、codex.exe 的 SHA-256 与大小、
构建时间、官方来源。
