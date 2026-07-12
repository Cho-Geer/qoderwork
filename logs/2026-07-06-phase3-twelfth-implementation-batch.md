# Phase 3 第十二批收尾对齐

**为什么**: plan 文档和 active 代码仍有偏差；agent 配置、自检脚本和 dispatch active path 还残留旧模式/旧断言。

**改了什么**:
- `../opencode/work-one/.opencode/agents/*.md` — 为非 KC agent 补 UC7KS 段落；给 6 个 writable/risk-bearing agent 补 `knowledge_cache_attest`；移除 `Super-Admin` 的直接 `context7_*`
- `../opencode/work-one/.opencode/service/dispatch/{dispatch-validate.ts,dag-policy.ts,router.ts}` — 继续去掉 active `mode` 语义，改为 policy/log 驱动
- `../opencode/work-one/.opencode/scripts/framework-self-test.ts` — 把 Check 37/43/70/71/74/75/77 迁到 active 架构断言
- `implementation-plans/phase3-implementation-plan.md` — 更新第十二批进度与验收状态

**决策**: Phase 3 收尾优先清 active path 和“自检误判”；剩余只读 DB/历史模块失败项不通过伪造状态掩盖，而是明确归类为沙箱约束或非 Phase 3 遗留。
