# Phase 2 G3: 收窄 dispatch_subagent 到 framework maintenance compat path

**为什么**: 交叉审核 G3（logs/2026-07-10-framework-simplification-cross-review.md）发现 `dispatch_subagent` 仍被非框架维护的 legacy 文件引用。plans/opencode-framework-simplification-roadmap/03-phase2-native-agent-dag.md Phase 2 Step5 完成门槛要求 "dispatch_subagent 只保留 framework maintenance compat 责任"。9 个 inactive legacy agent 不应持有 dispatch_subagent 授权。

**改了什么**:
- `.opencode/service/permission/legacy-agent-permissions.ts` — 删除 8 处 `    dispatch_subagent: "allow",`（Meta-Planner/Architect/Coder-BE/Coder-FE/Guardian/Arbiter/CI-CD-Agent/Super-Admin/Knowledge-Curator 等 legacy profile）。`bun build` 语法校验通过（Transpiled file in 12ms）。`rg -c dispatch_subagent` 该文件 = 0。
- `framework-state.db` — 新建 `dispatch_privilege_grants`（grantId `cb858418-5aac-4df2-b074-0063cac5a552`, status=consumed, writes_used=1, completed_at 已填）+ `framework_maintenance_plans`（planId `8836527e-78f2-4d7b-90f6-c12e8830a0b5`, status=completed）。planned_paths 含目标文件；codegraph_targets 含 `LEGACY_AGENT_PERMISSIONS`。

**决策**:
- 仅移除 legacy agent 的 dispatch_subagent 授权。**保留** service/dispatch/* compat path、skill-policy `WRITE_TOOLS`、checklist-validate `CORE_PASSTHROUGH_TOOLS`、enforcement.ts:202 / config-attest.ts:72 文本引用、framework-self-test M20+Layer2 —— 这些是 active/正确引用或纯文本，不构成 legacy 授权。
- 安全性依据：`reader.ts:137` 中 `LEGACY_AGENT_PERMISSIONS` 仅作 fallback，active 5 agent 在 opencode.json 有 permission 块（不会命中 fallback），故移除不影响 active 行为。CodeGraph impact 确认仅 `reader.ts` 消费该常量。
- 窄化授权即满足完成门槛；enforcement.ts/config-attest.ts 文本引用准确描述 "legacy dispatch_subagent wrapper"，不构成授权，保留。
- 证据等级：static/code（语法校验 + 结构性推理）。runtime smoke 未在本步驱动（需 OpenCode serve，非本步范围）。
