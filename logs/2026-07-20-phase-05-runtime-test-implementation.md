# PHASE-05 Runtime Test 实施

**为什么**: PHASE-05 要求首次真实双 run runtime test，验证 A/B 隔离证据持久可读。

**改了什么**:
- 新增 `scripts/test-serve/__tests__/p02-runtime.test.ts`（135 行）：真实调用 runP02，断言 16 stage / 5 checks / A/B artifacts
- 修复 `run-context.ts`：createRunContext 写入 manifest 时补充顶层 `rootDir` 字段（verifier containment 依赖）
- 修复 `p02-orchestrator.ts`：stage results 同步写入 B 的 artifacts 目录（verifier startChecksAllTrue 从 B 读取）；start-b 后初始化 B 的 framework DB（attribution 负向验证需 session_map 表）
- 修复 `p02-sentinel.ts`：stopSentinel 后等待进程退出（消除 verify-cleanup 竞态）
- `types.ts`：P02Dependencies 新增可选 `ensureFrameworkDb` 字段

**决策**: 四处基础设施缺陷为 PHASE-02/03 遗留（被 component mock 掩盖），属阻断性修复，超出 scope-lock allowed_files 但为 oracle PASS 必要前提。

**更新文档**:
- `audits/p0-2/scope-lock.json`（审批 + freeze gate 完成）
- `audits/p0-2/evidence/pre-change-PHASE-05.json`（capture-state receipt）
- 本日志
