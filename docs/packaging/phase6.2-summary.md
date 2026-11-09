# 阶段 6.2 总结

## 已完成

- 固化 EXE 构建流程（Node 26 固定、esbuild/postject 版本固定、SHA-256 + build-info.json）。
- 统一路径管理（installDir / bundledRuntimeDir / DicodeHome / config / data / logs）。
- Inno Setup 安装脚本脚手架（dicode.exe + resources，Runtime 默认不打包）。
- 安装/升级/卸载文档。

## 未完成（外部阻塞）

- 正式安装包构建（需 Codex Runtime 分发许可最终确认）。
- 真实安装/升级/卸载测试（需干净 Windows VM）。

## 回归

npm run typecheck / lint / test 通过（95/95）。
