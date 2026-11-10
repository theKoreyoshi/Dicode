# Dicode Windows 安装与部署

## 安装程序选型

选用 Inno Setup 6：

- 安装流程简单、体积小。
- 支持当前用户安装（PrivilegesRequired=lowest），无需管理员权限。
- 支持用户 PATH 配置、开始菜单快捷方式、覆盖升级、完整卸载。
- 不要求预装 Node.js（dicode.exe 已内嵌 Node 26）。
- 支持中文与空格安装路径。

## 安装目录

```text
Dicode/
  dicode.exe
  runtime/codex/     （分发许可确认后包含）
  resources/
  uninstall/
```

用户数据独立于安装目录：`%APPDATA%\Dicode\`（config/data/logs/cache）。

## PATH 管理

优先修改当前用户 PATH（HKCU Environment），避免重复添加，卸载时仅清理 Dicode 项。

## 使用安装包或便携版

运行 `Dicode-Setup-x64.exe`，安装完成后打开新的终端。也可解压
`Dicode-Portable-x64.zip` 后直接运行其中的 `dicode.exe`。
两个产物都已内嵌 Node.js，使用本机完整安装的官方 Codex Runtime。
已安装 Codex Desktop 时，Dicode 可自动查找其 Windows Runtime。

如果 Dicode 无法自动定位 Codex，请将 `DICODE_CODEX_EXE` 指向完整
Runtime 目录内的 `codex.exe`，然后检查连接。请保留官方安装目录中的
辅助程序，例如执行文件工具所需的 `codex-code-mode-host.exe`。诊断
通过表示 App Server 可以连接。

```powershell
$env:DICODE_CODEX_EXE = 'C:\Tools\Codex\codex.exe'
dicode doctor
dicode --cwd 'D:\Projects\Demo'
```

在当前终端运行便携版时，使用 `.\dicode.exe doctor` 和 `.\dicode.exe`。
Codex 的认证和模型配置由官方 Runtime 读取。

## 升级

新版本安装识别旧版本并覆盖程序文件；不覆盖用户配置、会话、数据库、认证信息；Runtime 升级通过 version.json 校验。

## 卸载

删除程序文件与内置 Runtime，清理快捷方式与 PATH；默认保留用户数据，提供显式清理选项。

## 合规阻塞

默认安装包使用外部 Runtime。仅在仓库记录的再分发条件满足后，才可用
`iscc /DBundleCodexRuntime installer\inno\dicode.iss` 构建内置 Runtime 的版本。
详见 [Runtime 分发结论](packaging/dicode-runtime-distribution-decision.md)。
