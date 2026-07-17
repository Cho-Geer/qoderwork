# T-PT-041 checklist (DRY-RUN plan)

## Status
- T-PT-041: READY (not executed)
- DRY_RUN: true
- FRAMEWORK_SKILL_READ_HARD_GATE: (not set)

## Prerequisites
- T-PT-048
- T-PT-049
- T-PT-039

## Subcases (6)
- SC-T041-01-before-order [order]: active before dispatcher order: skill-policy 在 safe-edit gate 之前先执行 → expected rule=skill-read-attest-required, executor counter=0
- SC-T041-02-db-state-missing [db-state]: DB state missing: 未 attest → 触发专用 rule (hard_block) → expected rule=skill-read-attest-required, executor counter=0
- SC-T041-03-db-state-invalid [db-state]: DB state invalid: attest:false (identity 不匹配) → 触发专用 rule → expected rule=skill-read-attest-required, executor counter=0
- SC-T041-04-safe-edit-deny [tool-dispatch/safe_edit]: safe_edit 被 dispatcher 拒绝 (executor counter=0) → expected rule=skill-read-attest-required, executor counter=0
- SC-T041-05-safe-framework-edit-deny [tool-dispatch/safe_framework_edit]: safe_framework_edit 被 dispatcher 拒绝 (executor counter=0) → expected rule=skill-read-attest-required, executor counter=0
- SC-T041-06-dispatch-subagent-deny [tool-dispatch/dispatch_subagent]: dispatch_subagent 被 dispatcher 拒绝 (executor counter=0) → expected rule=skill-read-attest-required, executor counter=0

## Oracle
- ORA-PT-12: 专用 rule (skill-read-attest-required) 抛出并到达 dispatcher;safe_edit / safe_framework_edit / dispatch_subagent 三个 executor entry 均为 0

## Required evidence (production run)
- handler chain trace (skill-policy 在 safe-edit-gate 之前)
- rule_id 命中记录 (每次拒绝的 ruleId)
- executor boundary counter (3 个 tool 各自 = 0)
- target state diff (目标文件/子 session 未被创建)
