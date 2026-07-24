# 2026-07-23 蓝图/计划与代码交叉审核

## 为什么
用户要求交叉审核 blueprint + plan 与 work-one 代码实施是否一致，并更新文档状态。

## 改了什么
- 交叉审核 3 份文档（2 blueprint + plan 目录 7 文件）与 work-one 代码。
- **关键发现**：blueprint v1.14.6 记录的 `plan: "Meta-Planner"` P0 映射 bug **已在代码中修复**，但文档仍标记为未修复。bun 实测确认：`toDisplayName("plan")="plan"`，`getAgentPermission("plan").safe_shell="deny"` 正确命中 opencode.json。
- 确认 permission template blueprint Phase 1/2 未启动（`templates.ts`、`permission_templates` config、`permission_template` binding 均不存在）；Phase 0R2 硬门基础设施已就位（`skill-read-attest-required=hard_block`、`resolveSkillAttestationIdentity`、skill-policy before tool-governance）。
- 确认 `isWriteAllowed` 零 caller（dead）、`getAgentShellAllowlist` 3 个生产 caller、`legacy-agent-permissions.ts` 905 行仍存在、`_hasAgentDangerousBypass` 仍 active。

## 决策
- 仅更新文档状态以反映代码实际，不修改 work-one 代码。
- permission template blueprint 状态"返工中"保持不变（准确）。
- framework simplification roadmap 中 plan->Meta-Planner 从 P0 改为 DONE。

## 更新了什么文档
- `blueprints/blueprint-opencode-framework-simplification-roadmap.md`（v1.14.5→v1.14.7）：§0.0 Enforcement 行、§0.6 #4、§六 priority matrix、新增修订日志条目
- `plans/opencode-framework-simplification-roadmap/00-overview.md`（v2.1.2→v2.1.3）：Phase 3 行 P0 note
- `plans/opencode-framework-simplification-roadmap/04-phase3-enforcement-slimming.md`（v2.1.2→v2.1.3）：§0 结论、per-agent 行、Step 2 P0、完成门槛
