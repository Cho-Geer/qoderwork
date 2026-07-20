# P0-2 PHASE-03 Sentinel/Orchestrator 第三轮代码复审

| 项 | 值 |
|---|---|
| 审计目标实施报告 | `logs/2026-07-19-p0-2-phase-03-rework-2.md` |
| 权威计划 | `plans/隔离 serve 测试基建待办/p0-2/03-phase-sentinel-orchestrator.md` |
| 前序审计 | `audits/p0-2/2026-07-19-phase-03-sentinel-orchestrator-audit-3.md` |
| 证据上限 | component；runtime-smoke / live-LLM-E2E NOT-RUN |
| 复审范围 | audit-3 的 D1–D4；不扩展至 PHASE-04 或真实 runtime |
| 正式归档状态 | `BLOCKED`：缺已批准 scope-lock、pre-change receipt 与不可变执行回执，不能签署为 plan-audit-archiver v2.1 正式裁决 |

## 1. 代码复审结论

**代码结论：REWORK。** PHASE-03 仍不得标记 `DONE`，PHASE-04 继续 `BLOCKED`。本轮复现的组件测试虽为 `183 pass / 0 fail / 4867 expect()`，但无法关闭 REQ-003 的负向证明和计划集验证门。

## 2. 前序 blocker 全量复核

| ID | 结果 | 本轮可复现证据 |
|---|---|---|
| D1 | OPEN | `failure → illegal cleanup-b → stop-a` 反例中，当前 `assertNoBusinessAfterFailure` 以最后一个业务事件为边界，输出 `currentAssertionWouldPass=true`，但计划合同判定为 `false`。 |
| D2 | OPEN | 对真实轻量 sentinel 注入 `SIGTERM EACCES` 后，`stopSentinel` resolved，且 `sentinelStillFoundAfterSignalFailure=true`；当前实现仍吞掉信号错误。 |
| D3 | OPEN | `bun run .agents/skills/deterministic-implementation-planning/scripts/validate-plan.ts plans/隔离 serve 测试基建待办/p0-2` 返回 `NO_COMPLETION_CHECKBOX`。 |
| D4 | OPEN | plan index 仍将 PHASE-01 写为 only implementation path，并把未被反证关闭的“精确 ledger”写成 component 达成。 |

## 3. 已复现但不构成关闭的项

- stop-a、stop-b、stop-sentinel 自身 throw 的 exact-once 组件用例通过。
- `convergenceErrors` 返回、ESRCH/EPERM 三态区分通过。
- 根 `bun run typecheck` 仍 exit 1，32 条诊断不在 PHASE-03 四个代码路径内；不将其写成全局 PASS。
- tracked `types.ts` 与三个 untracked PHASE-03 文件未发现 whitespace diagnostics。

## 4. 证据命令

```text
bun test scripts/test-serve/__tests__/verify-p02.test.ts scripts/test-serve/__tests__/p02-orchestrator.test.ts
→ 183 pass / 0 fail / 4867 expect()

bun run .agents/skills/deterministic-implementation-planning/scripts/validate-plan.ts plans/隔离 serve 测试基建待办/p0-2
→ exit non-zero: NO_COMPLETION_CHECKBOX
```

## 5. 退出条件

仅在 D1 的 failure boundary 反例失败、D2 的非 ESRCH signal error fail-closed、PLAN_SET validator exit 0、索引状态同步后，才可重新申请 Phase 03 复审。不得由本文件将 PHASE-03 升为 `DONE`。
