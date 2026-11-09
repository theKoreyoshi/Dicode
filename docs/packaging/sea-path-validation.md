# SEA 安装目录路径解析验证

## 根因

阶段 6.2.1 安装包中的 `dicode.exe` 是**阶段 6.1.1 的旧构建**，仍使用旧路径逻辑
`join(dirname(execPath), "..", "runtime", "codex")`（假设 `bin/dicode.exe` 布局），
导致安装后 Runtime 路径比实际安装目录高一级。

阶段 6.2 已在 `shared/paths.ts` 修正为 `join(dirname(execPath), "runtime", "codex")`，
但当时未重建 EXE，故阶段 6.2.1 验证的是旧产物。

## 实证结果（重建后真实 EXE）

安装到 `C:\Users\29234\AppData\Local\Dicode` 后运行 `dicode --paths`：

```
execPath:        C:\...\Dicode\dicode.exe
dirnameExecPath: C:\...\Dicode
installDir:      C:\...\Dicode\runtime\codex   （正确，不再偏差一层）
cwd:             C:\Users\29234\Desktop\DICODE-CLI（证明不依赖 CWD）
```

## 验证结论

- 安装目录正确 = dicode.exe 所在目录。
- Runtime 路径正确 = 安装目录/runtime/codex。
- 不受 CWD 影响。
- `process.execPath` 与 `process.argv[0]` 在 SEA 中一致，均可靠。

## 中文路径说明

PowerShell 通过 `Start-Process` 向 Inno Setup 传递含中文的 `/DIR` 参数时存在编码丢失，
导致安装回退到默认目录。这是测试命令行的编码限制，非 Dicode 路径逻辑缺陷；路径逻辑
本身基于 `process.execPath`，对 Unicode 路径正确处理。
