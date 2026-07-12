# Native Agent 与 Skill/Hook 重构路线图更新

**为什么**: 用户希望当前 OpenCode 框架重构方案更明确地增强复用性、灵活性，并以 Skill + Plugin Hook + 原生 Agent 为主轴，同时保留 QoderWork 指导桥接以提升弱模型输出质量。

**改了什么**:
- `blueprints/blueprint-opencode-framework-simplification-roadmap.md` — 升级为 v1.1.0，补充 native-agent first、Skill 能力层、Plugin Hook 治理层、QoderWork Guidance Bridge、弱模型质量保障和 alias/native executor 映射
- `blueprints/blueprint-opencode-framework-simplification-roadmap.md` — 重写 DB、Agent 拓扑、验证、优先级和最终指标，使路线图围绕可复用 Skill、可观察 Hook、可选 DAG 和最小 DB 状态展开

**决策**: 保留安全硬约束和 QoderWork bridge，流程类约束降级为 advisory；保留 10 个 Agent 名称作为兼容 alias，长期行为迁移到原生执行器与 Skill bundle。
