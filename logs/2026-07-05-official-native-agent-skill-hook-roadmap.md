# 官方原生 Agent 与 Skill/Hook 路线图强化

**为什么**: 用户进一步明确自定义 Agent 长期不如官方原生 Agent，可维护性和稳定性都不适合作为执行核心；弱模型问题与 Agent 名称关系不大，应聚焦 Skill 和薄 Plugin Hook。

**改了什么**:
- `blueprints/blueprint-opencode-framework-simplification-roadmap.md` — 升级为 v1.2.0，明确官方原生 Agent 默认执行，旧 10 个自定义 Agent 只作兼容 alias
- `blueprints/blueprint-opencode-framework-simplification-roadmap.md` — 新增“少 Agent，强 Skill，薄 Hook”设计转向、默认短执行路径、Hook 防膨胀规则和 legacy Agent 行为退役阶段

**决策**: 不再强化自定义 Agent prompt；普通任务默认走官方原生 Agent + Skill + 少量安全 Hook，DAG/checklist/DB 状态机只在大型、高风险、长任务或连续失败时启用。
