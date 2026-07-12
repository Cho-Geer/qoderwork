# Phase 3 第九批：active compat 分支继续收敛

**为什么**: 第八批已经清掉了大量用户可见旧话术，但 active 运行链里仍残留少量真正影响行为的 `getEnforcementMode()` 分支，尤其是 `pre-execution-gate.ts` 的 critical-files 和 UC7KS bypass 路径，仍然把 single-policy 目标拉回旧 mode 思维。

**改了什么**:
- `/home/zhaoge/workspace/opencode/work-one/.opencode/plugin-handlers/before/task.ts` — 删除无效的 `getEnforcementMode()` 依赖。
- `/home/zhaoge/workspace/opencode/work-one/.opencode/plugin-handlers/before/uc7ks.ts` — 改为通过 `knowledge-external-query` 的 rule disposition 决定是否抛错，不再直接看 `strict/locked`。
- `/home/zhaoge/workspace/opencode/work-one/.opencode/scripts/pre-execution-gate.ts` — `critical infrastructure files` 改为统一 warn/audit；UC7KS bypass attempt 和 Super-Admin knowledge gate 改按 `knowledge-external-query` rule disposition 判定；日志字段逐步从 `enforcement_mode` 转向 `enforcement_policy`。
- `/home/zhaoge/workspace/qoderwork/implementation-plans/phase3-implementation-plan.md` — 补记第九批实施与验证。

**决策**: 这批仍然坚持“只改 active 路径、只改活分支、不碰更大范围 legacy 骨架”的原则。`pre-execution-gate.ts` 的 CommonJS/测试兼容结构暂时保留，先把行为分支收敛干净，再考虑更大重构。
