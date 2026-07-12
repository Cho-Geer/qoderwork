# Smoke Test 执行 + 方案文档交叉验证

**为什么**: 用户要求按 smoke-test-plan.md 执行真实 session smoke test，并交叉验证 9 份方案文档与框架代码的一致性。

**改了什么**:
- `e2e/smoke-test-plan.md` — 新建 7 组 39 项测试方案
- `e2e/smoke-test-results-20260707.md` — 测试结果报告
- `/tmp/smoke-g1-db-tests-v2.ts` — G1 DB 查询测试脚本
- `/tmp/smoke-g3-safety.ts` — G3 安全阻断测试脚本
- `/tmp/smoke-g4-v2.ts` — G4 dispatch privilege 测试脚本
- `/tmp/smoke-g2-g5-g7.ts` — G2+G5+G6+G7 代码审计测试脚本

**结果**: 85 PASS, 0 FAIL, 13 BLOCKED
- G1 DB Runtime: 17/17 PASS（发现 `file_baseline_kv` 表名与计划不一致，已修正）
- G3 Safety Hard Block: 20/20 PASS
- G4 Dispatch Privilege: 22/22 PASS
- G2/G5/G6/G7: 26/26 code audit PASS, 13 BLOCKED（需要 live Orchestrator session）

**决策**:
- 交叉验证发现 `framework.db` 是空目录而非 DB 文件
- `file_baseline_kv` 是 v4 migration 创建的真实表名，非 `file_baselines`
- 13 项 BLOCKED 不是失败，是静态审计无法覆盖的运行时行为，需下次 live session 补充
