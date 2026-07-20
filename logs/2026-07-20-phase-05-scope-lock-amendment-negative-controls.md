# PHASE-05 Scope-Lock 修订与负控制执行

**为什么**: 审计 generation 1 判定 INVALID（F-001 scope violation：4 文件超出 allowed_files）。修复路径：修订 scope-lock → 重捕 receipt → 执行负控制 → 为重审做准备。

**改了什么**:
- 修订 `audits/p0-2/scope-lock.json`（v2）：allowed_files 从 1 个扩至 5 个；新增 amendment 字段记录修订原因；freeze_gate_status=REAPPROVED
- 新增 `audits/p0-2/evidence/pre-change-PHASE-05-v2.json`：重捕 receipt（916 entries, sha256: 4be25f59...）
- 更新 `plans/隔离 serve 测试基建待办/p0-2/00-plan-index.md`：PHASE-05 标记 DONE，Evidence ceiling 含 runtime 证据

**决策**: 采用 Option A（修订 scope-lock 纳入 4 文件）而非 Option B（回退代码），因为四处修复为阻断性基础设施缺陷。负控制使用端口占用（P02-R-PORT）和路径文件冲突（P02-R-ARTIFACT）两种方式，均成功迫使测试 FAIL，证明灵敏度。

**更新文档**:
- `audits/p0-2/scope-lock.json`（修订 v2 + 审批）
- `audits/p0-2/evidence/pre-change-PHASE-05-v2.json`（新建）
- `plans/隔离 serve 测试基建待办/p0-2/00-plan-index.md`（状态更新）
- 本日志
