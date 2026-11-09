# 0.167.0 协议对比

| Dicode 能力 | 当前 Adapter（alpha）| 0.167.0 实测 | 兼容性 |
| --- | --- | --- | --- |
| 启动方式 | codex app-server --listen stdio:// | 相同 | 兼容 |
| initialize | {clientInfo:{name,version}} | 相同结构 | 兼容 |
| initialized 通知 | 无参数 | 相同 | 兼容 |
| account/read | {account:{type}} | 相同 | 兼容 |
| model/list | {data:[{id,model,supportedReasoningEfforts}]} | 相同 | 兼容 |
| thread/list | {data:[...]} | 相同 | 兼容 |
| config/read | {config:{...}} | 相同 | 兼容 |

## 结论

0.167.0 的 App Server 协议与当前 Adapter 使用的协议**完全一致**，属于「启动入口不变、协议不变」的情况，非协议变更。
