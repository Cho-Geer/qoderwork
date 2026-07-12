# Phase 3 第十四批 UC7KS 与 native-Task compat 收口

**为什么**: `qoderwork/plans/04` 和 `plans/06` 里已明确要求去掉 active path 的 mode 分支，并让 `DISPATCH_TOKEN` 退回 legacy compat 语义；但 live 代码里 UC7KS 和 pre-exec gate 还残留 mode 传参、KC token 硬门叙事。

**改了什么**:
- `/home/zhaoge/workspace/opencode/work-one/.opencode/service/knowledge/cache-check.ts` — 去掉 `checkUC7KS()` / `buildUC7KSError()` 的 live mode 依赖，改为 disposition 驱动
- `/home/zhaoge/workspace/opencode/work-one/.opencode/plugin-handlers/before/uc7ks.ts` — legacy handler 日志改为 `policy=` 语义，不再读 `getEnforcementMode()`
- `/home/zhaoge/workspace/opencode/work-one/.opencode/scripts/pre-execution-gate.ts` — KC 缺 `DISPATCH_TOKEN` 改为 native `Task` 兼容 audit-first；compat helper 改成 policy label 表述
- `/home/zhaoge/workspace/qoderwork/plans/{04-phase3-enforcement-slimming.md,06-phase5-legacy-retirement.md}` — 同步 T3.1/T3.8 和 V5.3/V5.6 当前进展
- `/home/zhaoge/workspace/qoderwork/implementation-plans/phase3-implementation-plan.md` — 记录第十四批状态

**决策**: 这一批优先清 active 运行时里的“旧 mode / 旧 wrapper 必经”叙事，而不是先清历史测试。因为弱模型和真实执行链首先会受到这些热路径文案和阻断条件影响。
