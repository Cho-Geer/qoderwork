# PHASE-05 审计 ACCEPT 闭合

**为什么**: 审计 generation 1 判定 INVALID（scope-lock 过窄），经修订 scope-lock v2 + 重捕 receipt + 负控制后，generation 2 审计判定 ACCEPT。

**改了什么**:
- `audits/p0-2/2026-07-20-phase-05-runtime-test-audit-2.md`（567 行）：ACCEPT，validate-audit.ts exit 0
- `audits/p0-2/scope-lock.json`：升级至 schema 2.0，新增 plan_registry/scope/approval 结构
- `audits/p0-2/LATEST.md`：指针更新为 audit-2 ACCEPT
- `plans/隔离 serve 测试基建待办/p0-2/00-plan-index.md`：PHASE-05 状态含审计 ACCEPT

**决策**: F-001 scope violation 通过 Option A（scope-lock amendment + human approval）关闭。3 个负控制（P02-R-PORT, P02-R-ARTIFACT x2）全部 SENSITIVE。PHASE-06 审计层面解锁，但仍需第二组 reviewer 端口方可执行。

**更新文档**:
- `audits/p0-2/2026-07-20-phase-05-runtime-test-audit-2.md`（新建，由审计 session 完成）
- `audits/p0-2/scope-lock.json`（schema 2.0 升级）
- `audits/p0-2/LATEST.md`（指针更新）
- `plans/隔离 serve 测试基建待办/p0-2/00-plan-index.md`（状态同步）
- 本日志
