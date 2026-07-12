# 单一执行策略取消模式矩阵

**为什么**: 用户明确希望去掉当前框架的 advisory/strict/locked 模式，不再存在不同运行模式，避免模式矩阵继续增加分支、阻塞和维护复杂度。

**改了什么**:
- `blueprints/blueprint-opencode-framework-simplification-roadmap.md` — 升级为 v1.2.1，新增“单一执行策略：取消 advisory/strict/locked 模式”
- `blueprints/blueprint-opencode-framework-simplification-roadmap.md` — 将 advisory/strict/locked 和 native/tracked/planned 模式表述改为固定规则处置与单一路径附加能力

**决策**: 是否阻断由规则类型决定，不由全局模式决定；规则固定为 hard_block、warn_and_continue、audit_only 或 ask_qoderwork。
