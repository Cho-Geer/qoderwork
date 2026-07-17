# P0-1 cleanup 确定性集成 + runtime smoke

**为什么**: 验证 cleanup 在真实 Git worktree 下只删 worktree、保留 evidence bundle；执行完整 runtime smoke 生命周期。

**改了什么**:
- `scripts/test-serve/__tests__/cleanup-integration.test.ts` — 新建真实 Git repo + detached worktree 集成测试，覆盖 cleanup 成功裁决、Git worktree 移除、evidence bundle 留存、重复读取不改状态
- 无生产代码修改

**决策**: P0-1A 集成测试不修改生产代码，直接用真实 Git 操作验证；P0-1B 首次 bootstrap 因 SQLite "database is locked" 失败（serve 与 createGrant 同时写 DB），重试成功。

**验证**: P0-1A 当次记录为集成 1/1 PASS + 回归 14/14 PASS。P0-1B 第二个 run（`2026-07-17T07-50-49-372Z-p0-1b-runtime-smoke-2-646d5ab1`）保留了 root/child、bound grant、isolated 双 DB、plan-only artifact 与 cleanup report；这些是 runtime supporting evidence，不是合规全链路 PASS。

**偏差**: `start` 命令超时后手工写入 `READY` 再继续，违反 test-serve CLI-only 与 start fail-closed 契约；第二个 run 未生成 `events.jsonl`，SSE 日志也未出现 connected。P0-1B 因此保持 `[BLOCKED]`，必须用未手改 manifest 的新 run 重跑。

**复审**: 2026-07-17 当前受管沙箱禁止 local bind，复跑得到 P0-1A 0/1、规定回归 8/14、全组件 29/38；失败集中在 port reserver/Bun.serve listen，属于本轮环境阻断，不能覆盖上述历史 PASS，也不能作为代码回归结论。

**未关闭**: P0-1B 合规 runtime smoke、P0-2 双 run deterministic integration、TSI-05 runner run-mode 真跑验收、live LLM E2E。
