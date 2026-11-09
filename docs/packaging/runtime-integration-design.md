# Runtime 正式集成设计（后续阶段）

## 目标目录

```text
Dicode/
  dicode.exe
  runtime/codex/
    codex.exe
    官方必要伴生文件
    LICENSE
    NOTICE
    version.json
  resources/
```

## 集成约束

1. Runtime 与 Dicode 独立存放，不修改官方二进制。
2. 不改变 App Server 通信协议与官方认证流程。
3. Runtime 版本固定，不自动下载未知版本。
4. version.json 记录版本、来源、文件清单、SHA-256。
5. Doctor 校验 Runtime 存在性、版本与文件完整性。
6. 安装包附带 LICENSE/NOTICE。

## 待验证的兼容性

稳定版 `codex.exe` 是否仍支持 `app-server` 子命令，或需改用独立的
`codex-app-server.exe`。若需切换，需最小化调整 Adapter 的进程启动参数。
