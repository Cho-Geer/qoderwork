# OpenCode 框架瘦身路线图

**为什么**: 基于架构评估审核结果，需要一份不推翻重写、但能降低多 Agent、DB-canonical、硬约束和 DAG 复杂度的可执行重构方案。

**改了什么**:
- `blueprints/blueprint-opencode-framework-simplification-roadmap.md` — 新增 6 阶段路线图：事实校准、Skill-first prompt diet、DAG 解耦、enforcement 热路径瘦身、DB hot-path slimming、Agent 拓扑压缩

**决策**: 采用“保留安全外壳、拆掉流程脚手架；保留审计状态、移出默认热路径；保留 Agent 名称、迁移行为到 Skill”的渐进方案，避免一次性删除 DB/DAG/Agent 造成不可控回归。
