# legacy-agent-permissions.ts 调查：发现 plan->Meta-Planner stale 映射 bug

**为什么**: blueprint 收敛后除 Orchestrator 外无自定义 agent，调查 `service/permission/legacy-agent-permissions.ts`（905 行 legacy 权限 fallback）是否仍有问题。

**改了什么**（仅文档，未改代码）:
- `blueprints/blueprint-opencode-framework-simplification-roadmap.md` - §0.0 Enforcement 行、§0.6#4、优先级矩阵新增 P0 项、修订日志 2026-07-13 条目
- `plans/00-overview.md` / `01-phase0` / `03-phase2` / `04-phase3` / `06-phase5` - 同步 plan 映射 bug、router.ts:235/agent_domain_map 遗留项、A2 核查修正、V5.10 验证项
- `plans/02-phase1` / `05-phase4` - 经判断与本次发现无关，未改

**决策**: 发现 P0 bug：`agent-identity.ts` DISPLAY_NAMES 的 `plan: "Meta-Planner"` 映射导致 plan agent 权限走 legacy fallback，opencode.json plan 配置被忽略（safe_shell 配置 deny 实际 allow-all）。经 bun 实测 + codegraph impact（13 caller）确认修复安全。未立即改代码，待用户确认。额外发现：router.ts:235 auto_plan 硬编码 Meta-Planner、agent_domain_map 用 legacy 名、Phase3 A2 核查漏检。
