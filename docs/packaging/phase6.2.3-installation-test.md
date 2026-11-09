# 完整安装包真实安装验证

## 安装

- 安装包：release/Dicode-Setup-x64.exe
- 安装目录：C:\Users\29234\AppData\Local\DicodeFinal
- 安装 exit 0。

## 安装目录结构

```text
dicode.exe           100.8MB
runtime/codex/codex.exe  352MB
runtime/codex/version.json
resources/
unins000.exe
```

## 验证结果（全部通过）

| 验证项 | 结果 |
| --- | --- |
| dicode --version | Dicode 0.1.0 |
| dicode --doctor | Environment Ready（全部 OK）|
| Bundled Runtime | OK（0.167.0，内置路径）|
| App Server | OK（initialize + model/list）|
| SQLite | OK |
| 真实消息交互 | 通过（userAgent: Codex Desktop/0.167.0 ... Dicode 0.1.0）|
| 会话创建/恢复 | 通过（6/6 集成测试）|
| 环境隔离 | 使用内置 Runtime，非系统 Codex |

## 未验证项

- 工具调用（本阶段未触发需工具的任务）。
- 干净 Windows VM 全链路。
