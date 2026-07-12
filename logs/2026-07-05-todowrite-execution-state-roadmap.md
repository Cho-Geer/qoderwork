# TodoWrite 执行状态机路线并入 plan

**为什么**: 用户希望 TodoWrite 不只是用户可视化进度，而是能实质帮助弱模型保持目标、步骤顺序、失败恢复和 Skill 执行路径，同时不破坏 skill-first/light-weight 重构方针。

**改了什么**:
- `plans/00-overview.md` — 将 TodoWrite 新定位写为弱模型外置工作记忆和轻量执行状态机
- `plans/02-phase1-skill-first.md` — 在 `preflight-lite` 中加入 TodoWrite 分级策略、执行纪律、Skill todo 模板和 Hook/QoderWork 配合
- `plans/04-phase3-enforcement-slimming.md` — 增加 TodoWrite 缺失/停滞/错配的 warn/audit 治理边界
- `plans/05-phase4-minimal-state.md` — 明确 TodoWrite 不写旧 checklist DB，只保留原生状态和轻量 audit
- `plans/06-phase5-legacy-retirement.md` — 增加 TodoWrite execution-state 回归验证和弱模型回归场景

**决策**: TodoWrite 可对 standard/high-risk 任务强提醒使用，但不能成为普通任务 hard gate；真正硬约束仍由 scope、permission、codegraph、dangerous shell 和 guidance gate 执行。
