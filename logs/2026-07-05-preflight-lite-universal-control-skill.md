# Preflight-lite universal control skill

**为什么**: 用户明确 `execution-preflight-check` 的初衷不是可选 Skill，而是任何任务都会加载的通用任务流程规范约束型 Skill，并希望改名为 `preflight-lite`。

**改了什么**:
- `plans/00-overview.md` — 将 P0 项从重写 `execution-preflight-check` 改为重命名并优化为新版 `preflight-lite`。
- `plans/02-phase1-skill-first.md` — 新增 `preflight-lite` 定位、建议 SKILL.md 核心内容、风险分级、执行型 Skill 选择矩阵和重命名影响清单。
- `plans/04-phase3-enforcement-slimming.md` — 明确新版 `preflight-lite` 可保留通用流程约束，但必须删除旧 DAG/gate/checklist 大门。
- `plans/06-phase5-legacy-retirement.md` — 将回归验证从旧 `execution-preflight-check` 改为新版 `preflight-lite`。

**决策**: 新版 `preflight-lite` 是 all-task universal control skill；它负责目标复述、风险分类、选择任务匹配的执行 Skill、最低证据和升级/提问规则。具体执行交给任务 Skill，硬阻断交给 active hooks。
