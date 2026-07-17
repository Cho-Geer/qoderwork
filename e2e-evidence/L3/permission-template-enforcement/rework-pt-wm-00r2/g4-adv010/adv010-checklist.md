# ADV-PT-010 charter checklist (DRY-RUN plan)

## Status
- ADV-PT-010: READY (not executed)
- DRY_RUN: true
- FRAMEWORK_SKILL_READ_HARD_GATE: (not set)

## Prerequisites
- T-PT-048
- T-PT-049
- T-PT-050

## Mutations (4)
- mutate_writer_trusts_task_id: writer (skill-attest.ts:recordRead) 改用 caller 传入的 `task_id` 参数作为 canonical scope（不再调用 shared resolver）
- mutate_validator_independent_resolver: validator 独立实现 resolveTaskId(sessionID) 而不复用 writer 的 resolveSkillAttestationIdentity
- mutate_order_swap: 交换 .opencode/project.config.json.plugin_execution_order.before 中 skill-policy 与 tool-governance 的位置
- mutate_root_fallback_removed: 删除 root scope 兜底 (root session 应有 session:<sessionID> fallback)，child-only resolver 单独运行

## Identity cases (5)
- root_dispatch [root]: dispatch_subagent → allow (scope=session:<rootSessionID>)
- child_safe_edit [child]: safe_edit → allow (scope=task:<childDagTaskId>)
- cross_scope_replay [child]: safe_edit → deny-hard-block (scope=task:<stolenDagTaskId>)
- stale_state [child]: safe_edit → deny-hard-block (scope=task:<childDagTaskId>)
- unknown_tool [child]: unknown_tool_2099 → deny-hard-block (scope=task:<childDagTaskId>)

## Order contracts (6)
- OC-1: skill-policy before tool-governance: skill-policy 必须在 tool-governance 之前执行（authoritative active config + runtime trace 双证）
- OC-2: skill-read-attest-required 在 skill-policy 抛: skill-read-attest-required 抛出于 skill-policy handler 内（专用 hard_block）
- OC-3: tool-governance 在 skill-policy 之后: tool-governance 在 skill-policy 之后（让 hard-block 先触发）
- OC-4: shell-policy 在 tool-governance 内: shell-policy 必须由 tool-governance 调度（在 skill-policy 之后但在 executor 之前）
- OC-5: repo-policy 在 tool-governance 内: repo-policy 必须由 tool-governance 调度（read/write 分类统一）
- OC-6: codegraph-enforce 在所有写工具前: codegraph-enforce 必须在 safe_edit/safe_delete/safe_restore/safe_shell 4 个写工具前执行

## Required evidence (production run)
- mutation score (mutant survived / killed)
- active config diff (before/after .opencode/project.config.json)
- root/child DB lifecycle trace (writer/validator share resolver)
- handler order trace (skill-policy < tool-governance in runtime)
- 5 identity case results (root/child positive, cross-scope/stale/unknown all deny)
