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
  runtime/codex/
    bin/
    codex-path/
    codex-resources/
    codex-package.json
    version.json
  resources/
  licenses/
```

用户数据独立于安装目录：`%APPDATA%\Dicode\`（config/data/logs/cache）。

## PATH 管理

优先修改当前用户 PATH（HKCU Environment），避免重复添加，卸载时仅清理 Dicode 项。

## 使用安装包或便携版

运行 `Dicode-Setup-x64.exe`，安装完成后打开新的终端。也可解压
`Dicode-Portable-x64.zip` 后直接运行其中的 `dicode.exe`。
两个产物都包含 Node.js 与官方 Codex 0.167.0 Windows x64 编码运行时。
启动时，Dicode 直接从安装目录或解压目录加载包内运行时和辅助程序。
`dicode doctor` 检查文件、App Server 连接和账号状态。新设备若提示需要
登录，运行 `dicode login`，在浏览器中完成官方 Codex 登录。

```powershell
dicode doctor
dicode login
dicode --cwd 'D:\Projects\Demo'
```

使用便携版时，在对应命令前加 `.\dicode.exe`，例如 `.\dicode.exe login`。
Codex 的认证和模型配置由官方 Runtime 读取。

## 升级

新版本安装识别旧版本并覆盖程序文件；不覆盖用户配置、会话、数据库、认证信息；Runtime 升级通过 version.json 校验。

## 卸载

卸载会删除程序文件与内置运行时，并清理快捷方式与 Dicode 的 PATH 条目。用户数据保留在用户目录中。

## 运行时来源

安装包使用 OpenAI 官方 Windows x64 发行包中的编码运行时，保留原始目录结构和二进制。
文件包括 App Server、代码工具主机、命令执行服务器、Windows 沙箱辅助程序和 ripgrep。
Dicode 当前支持文本编码交互，打包范围为官方发行版的编码组件。
见 [运行时来源与校验](runtime-distribution.md)。
