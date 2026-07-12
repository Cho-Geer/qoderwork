# Smoke Test 结果复核与文档同步

**为什么**: `e2e/smoke-test-results-20260707.md` 显示 35/39 PASS，但 G4-005 和 G6 需要按证据级别拆分，避免把组件级 PASS 或不存在的 REST 端点写成完整通过。

**改了什么**:
- `e2e/smoke-test-plan.md` — 从待执行改为已执行后修正，校正 G4-005、G6 guide/reply 和 backup 首次创建预期
- `blueprints/` — 更新 dispatch privilege、TodoWrite、serve-api、question hybrid、framework roadmap 的 smoke 复核状态
- `plans/` — 更新 00-06 的 DB 表数、native Task、Safety Hard Block、TodoWrite、Context7/Scout、QoderWork bridge 和 dispatch grant 遗留任务

**决策**: G2/G3/G5/G7 可提升为 runtime smoke PASS；G4-005 仍是 PARTIAL/BLOCKED；G6 的正确通道是 `prompt_async + agent`、`/question/{QID}/reply` 和 abort，不存在 `/session/{SID}/guide|reply|interrupt`。
