# P0-2 debt 状态更新

- 原因：根据 2026-07-22 对 PHASE-03/04 NON_BLOCKING_DEBT 的代码、component 与 runtime-smoke 复核，更新历史 debt 状态。
- 结果：F-04-001/F-04-002/F-04-003 标记为已关闭；F-03-001 标记为项目约定；F-03-002 标记为治理限制已收敛。
- 保留：F-COMMON-001 作为 PHASE-01~04 无法回建 v2.1 pre-change receipt 的历史限制。
- 文档：更新 `debt/隔离 serve 测试基建待办/p0-2/2026-07-19-phase-03-04-non-blocking-debt.md`。
- 证据：P02 CLI 组件测试 7/7 PASS；两组 PHASE-05/06 runtime artifact 各 16 stage 全部 ok，cleanup success=true。
