# Brainstorming 与 ACP 主动监督质量下限

**为什么**: 用户希望更激进地组合 brainstorming Skill 和 QoderWork ACP，因为弱模型经常不会主动提问，也不知道该问什么，需要用外部监督和结构化澄清提高输出质量下限。

**改了什么**:
- `blueprints/blueprint-opencode-framework-simplification-roadmap.md` — 升级为 v1.3.0，新增 Active Clarification Layer、Brainstorming + QoderWork ACP 主动澄清策略
- `blueprints/blueprint-opencode-framework-simplification-roadmap.md` — 增加微型 brainstorming 卡片、完整 brainstorming 触发条件、ACP 主动监督规则、提问预算、回归测试和验收指标

**决策**: 普通任务默认微型澄清卡片，复杂/高风险任务触发完整 brainstorming；ACP 主动观察澄清缺口并注入短 guidance，但不变成逐步审批或新 gate。
