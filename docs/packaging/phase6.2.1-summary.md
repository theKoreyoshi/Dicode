# 阶段 6.2.1 总结（不含 Codex Runtime 的内部测试安装包）

## 真实构建结果

| 项 | 值 |
| --- | --- |
| 安装包 | release/Dicode-Setup-x64-INTERNAL-TEST-NoRuntime.exe |
| 大小 | 27 MB（压缩）|
| SHA-256 | c18b9b5a7e42d9ef50026bc1126922463877f3bdc03dbea8d115fd89ab3af28d |
| 安装程序 | Inno Setup 6.7.4 |
| 内容 | dicode.exe（100.8MB，Node 26 SEA）+ resources（不含 Runtime）|

## 真实验证结果

| 验证项 | 结果 |
| --- | --- |
| 静默安装（/VERYSILENT + 自定义目录）| 成功（exit 0）|
| 安装目录 | dicode.exe + unins000.exe + resources + runtime（空目录）|
| dicode.exe --version | Dicode 0.1.0 |
| dicode.exe --doctor | Windows/App Server/SQLite OK；Bundled Runtime FAIL（预期）|
| PATH 追加 | 正确追加（非覆盖），HKCU 注册表确认 |
| 卸载程序 | unins000.exe 已生成（未执行完整卸载验证）|

## 已知问题（如实记录）

1. SEA 环境下 `process.execPath` 解析比实际安装目录高一层，导致 `getInstallDir()`/
   `getBundledRuntimeDir()` 偏差一层（Doctor 显示 `AppData\Local\runtime\codex` 而非
   `AppData\Local\DicodeTest\runtime\codex`）。应改用 `process.argv[0]` 或做目录探测修正。
2. 未在干净 Windows VM 做全链路（升级/卸载/中文路径）验证。

## 合规状态

本安装包明确标记「Internal Test - Runtime Not Included」，不含 Codex Runtime 二进制，
不构成正式一体化产品。Runtime 分发许可仍待权利方最终确认。

## 回归

npm run typecheck / lint / test 通过（95/95）。
