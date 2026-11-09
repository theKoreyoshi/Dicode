# Dicode Runtime 分发结论

## 结论：有条件通过（方案 B）

Apache 2.0 许可证在技术上授权以 Object 形式再分发 Codex 二进制，但仍需满足以下
条件后方可纳入正式安装包：

1. 使用稳定版 `rust-v0.167.0`（非 alpha）。
2. 取得公司法务或权利方书面确认。
3. 随包附带 Apache 2.0 LICENSE、版权声明与 NOTICE。
4. 取得官方预编译二进制的第三方依赖清单（SBOM/NOTICE）。
5. 明确商标/品牌使用边界，不暗示 OpenAI 背书。
6. 验证稳定版 App Server 二进制结构与 Dicode Adapter 的兼容性。

## 阻断项（在满足前不得纳入正式包）

- 官方预编译包缺少 SBOM/NOTICE，第三方组件许可证不明确。
- Windows 产物缺少官方签名/校验文件。
- 无公司法务书面确认。

## 当前状态

保留「不含 Runtime」的内部测试安装包，不将未确认授权的 Runtime 纳入正式分发。
