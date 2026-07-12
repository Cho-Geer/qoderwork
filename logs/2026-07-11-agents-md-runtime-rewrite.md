# work-one/AGENTS.md 按运行态重写

**为什么**: AGENTS.md 描述「三层九角色」9-agent 架构、引用不存在的 `framework-enforcer.ts` 与未接入的 `before-dispatcher.ts`，与当前 5-agent 运行态严重不符；它是 agent 会话启动时自动加载的全局规范，失真会直接误导 agent 行为。用户确认「按运行态重写」。

**改了什么**:
- `work-one/AGENTS.md` 整体重写为运行态规范：
  - §1 体系总览（5 agent / 5 plugin / 39 handler / 37 tool / 12 MCP / 18 skill / v37 DB，附权威配置源）
  - §3 实际 5 agent 清单（含 opencode.json L17-338 实测模型：Orchestrator deepseek-v4-flash、build deepseek-v4-pro、general deepseek-v4-flash、plan glm-5.2、explore glm-5.2）
  - §4 active `plugin_execution_order`（project.config.json L1906-1936），标注 `framework-enforcer.ts` 不存在、`before-dispatcher.ts` 未接入
  - §5 18 个活跃 skill + `skill-summary` 注入逻辑（含 `AGENT_SKILLS` 仅映射 Orchestrator，9 个 blueprint 条目已清理）
  - §6 dispatch/grant/plan/`safe_framework_edit` 治理链
  - §7 DB v37 关键表 + 废弃表
  - §8 serve-api 交互（含 Content-Type 致命坑）
  - §9 轻路径/治理路径双轨
  - §10 设计蓝图（10-agent / DAG / booking demo）降级为仅供参考附录
- 正文一律以运行态为准，蓝图内容归档至 `blueprints/`。

**决策/验证**: 事实均经实测锚定——opencode.json agent 模型、project.config.json active order、grep 确认 `framework-enforcer.ts` 无文件、`.opencode/skills/` 18 个活跃 skill。**AGENTS.md 位于 work-one 根目录（非 `.opencode/**`），编辑不需 framework-maintenance grant/plan。**
