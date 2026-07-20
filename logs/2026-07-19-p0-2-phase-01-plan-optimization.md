# 2026-07-19 P0-2 Phase 01 实施文档优化

**Why**: 准入复审确认 Phase 01 的功能契约正确，但 matrix、短路断言和代码/状态范围表达不足，导致实现未达 gate 却被标记完成。

**What**: 将 `01-phase-verifier-isolation.md` 改为 `REWORK-REQUIRED`；明确 DB/events 真三态、attribution 首错返回、代码与状态 scope 分离；新增 19 字段三类路径 Test ID 台账和 attribution chain 台账。

**Decision**: 保持八 Phase 顺序；PHASE-01 通过前 PHASE-02 固定为 `BLOCKED`。Phase 01 的测试必须由台账生成 88 个负向 case 和一个 `P02-V-ALL`。

**Evidence**: 计划集结构校验当前为 `ok:true`；本次文档改动后必须重跑 validator、`git diff --check` 和计划专用测试。

**Documents**:
- `plans/隔离 serve 测试基建待办/p0-2/01-phase-verifier-isolation.md`
- `plans/隔离 serve 测试基建待办/p0-2/00-plan-index.md`
- `logs/2026-07-19-p0-2-phase-01-plan-optimization.md`
