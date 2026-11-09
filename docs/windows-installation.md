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

## 升级

新版本安装识别旧版本并覆盖程序文件；不覆盖用户配置、会话、数据库、认证信息；Runtime 升级通过 version.json 校验。

## 卸载

删除程序文件与内置 Runtime，清理快捷方式与 PATH；默认保留用户数据，提供显式清理选项。

## 合规阻塞

Codex Runtime 分发许可尚未由权利方最终确认，正式安装包不得包含未授权的 Runtime 二进制。
安装脚本已预留 runtime/codex 目录，但默认注释不打包。
