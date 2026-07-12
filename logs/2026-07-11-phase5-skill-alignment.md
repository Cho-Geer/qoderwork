# Phase 5 P5-C: skill-summary.ts AGENT_SKILLS 过期引用清理

**为什么**: `skill-summary.ts` 的 `AGENT_SKILLS` 映射枚举了 9 个未注册 blueprint agent（Super-Admin / Coder-BE / Coder-FE / Guardian / Architect / Meta-Planner / Arbiter / CI-CD-Agent / Knowledge-Curator）。但运行态 `opencode.json` 仅注册 Orchestrator + 4 native；`resolveAgent()` 永远返回这 5 个名字之一（或 "unknown"），绝不返回那 9 个 → 9 条是不可达死配置，徒增维护噪音。

**改了什么**:
- `.opencode/plugin-handlers/system/skill-summary.ts` — 删除 `AGENT_SKILLS` 中 9 个 blueprint agent 条目（原 L98–133），仅保留 `Orchestrator` 条目（8 个已注册 skill：preflight-lite / context7-first / codegraph-first / opencode-mcp-integration / multi-agent-orchestration / dispatch-protocol / deliverable-contract / review-arbitration）。`KEYWORD_TRIGGERS` / `COMMON_SKILLS` 不受影响（brainstorming / ci-cd-guardrails 等仍由关键词逻辑引用）。

**验证**:
- `codegraph impact "AGENT_SKILLS"` → 仅影响本文件 `constant AGENT_SKILLS:92` + `function handle:290`，无其他读者
- grep 确认 9 个名字已从该文件移除（0 命中）
- `bun build --target bun` 转译通过（Bundled 38 modules, EXIT=0）
- 自检 `checkAgentSkillsClean`（framework-self-test.ts:491，Check 8）扫描 `.opencode/agents/*.md` 而非 `AGENT_SKILLS`，无回归

**决策**: 直接精确编辑（WorkBuddy 侧，非 agent runtime 路径 → framework-maintenance 的 `safe_framework_edit` grant/plan 钩子不触发）。DB 检查：`dispatch_privilege_grants` 27 行全为 E2E 测试残留（status=consumed/pending/expired，路径 `.opencode/service/dispatch/**`、`.opencode/lib/**`），`framework_maintenance_plans` 5 行全 completed，无任何活跃 grant/plan 门控此文件。变更为零运行时行为影响的死配置删除。
