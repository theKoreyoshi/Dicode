# 阶段 6.2.2 总结

## 五个问题的回答

1. 正式稳定版：rust-v0.167.0（2026-11-06，唯一非预发布）。
2. Windows x64 包包含：codex.exe、codex-app-server.exe、code-mode-host、
   windows-sandbox-setup/service、responses-api-proxy、config-schema、install.ps1。
3. 各组件许可证：源码为 Apache 2.0；官方预编译包的第三方组件许可证无法从发布包确认。
4. 第三方 NOTICE：不完整（官方未提供 SBOM/NOTICE）。
5. 额外分发条件：Apache 2.0 附带 LICENSE/NOTICE/版权声明义务；商标不授予。
6. Apache 2.0 是否满足：技术上授权二进制再分发，但需满足附带义务与第三方确认。
7. 能否放入安装包：有条件通过（需法务/权利方确认）。
8. 需附带的材料：LICENSE、NOTICE、版权声明。
9. 是否需法务确认：是。
10. 是否具备进入 6.2.3 条件：否，需先满足上述条件。

## 最终结论

**有条件通过（方案 B）**。不得自动进入 6.2.3，需先取得书面授权与第三方声明。

## 回归

本阶段无业务代码改动，npm run typecheck / lint / test 保持 98/98。
