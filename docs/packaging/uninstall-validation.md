# 卸载机制验证（内部测试安装包）

## 结果

| 验证项 | 结果 |
| --- | --- |
| 卸载执行（unins000.exe /VERYSILENT）| exit 0 |
| PATH 清理 | 仅移除 Dicode 自己添加的项（DicodeTest），其他项完整保留 |
| 安装目录 | 已删除 |
| 用户配置 | 保留（%APPDATA%\Dicode\config.json）|
| 用户数据 | 保留（%APPDATA%\Dicode\data\test.txt）|

## PATH 前后对比

卸载前 PATH 末尾含 `...\Programs\Dicode;...\DicodeTest`。
卸载后 `DicodeTest` 被移除，其余（Anaconda、VS Code、npm 等）完整保留。

## 结论

卸载只删除程序文件与 Dicode 自己添加的 PATH 项，不删除用户数据，不覆盖其他环境变量。
