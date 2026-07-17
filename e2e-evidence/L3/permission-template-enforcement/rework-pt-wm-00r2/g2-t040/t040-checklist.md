# T-PT-040 checklist (DRY-RUN plan)

## Status
- T-PT-040: READY (not executed)
- DRY_RUN: true
- FRAMEWORK_SKILL_READ_HARD_GATE: (not set)

## Prerequisites
- T-PT-048
- T-PT-039

## Subcases (7)
- SC-T040-01-caller-label [caller-label]: baseline: caller task label 单独变化 → 旧状态有效,权限不扩大不缩小 → expected old_state_valid=true, new_state_valid=true, permission_unchanged=true
- SC-T040-02-session-id [sessionID]: cross-dim: sessionID 变化 → 旧状态失效 → expected old_state_valid=false, new_state_valid=false, permission_unchanged=false
- SC-T040-03-agent [agent]: cross-dim: agent 变化 → 旧状态失效 → expected old_state_valid=false, new_state_valid=false, permission_unchanged=false
- SC-T040-04-scope [canonicalTaskScope]: cross-dim: canonicalTaskScope 变化 → 旧状态失效 → expected old_state_valid=false, new_state_valid=false, permission_unchanged=false
- SC-T040-05-required [required]: cross-dim: required list 变化 → 旧状态失效 → expected old_state_valid=false, new_state_valid=false, permission_unchanged=false
- SC-T040-06-skill-content [skill-content]: cross-dim: Skill 文件内容变化 → 旧状态失效 → expected old_state_valid=false, new_state_valid=false, permission_unchanged=false
- SC-T040-07-fail-auth-overwrite [fail-auth]: fail-auth overwrite: 失败认证清除/覆盖之前 allow 状态 → expected old_state_valid=false, new_state_valid=false, permission_unchanged=false

## Oracle
- ORA-PT-11/13: caller label 是审计维度(单独变化不失效);其他 5 个身份/授权维度变化 → 旧状态失效;失败认证 → 清除旧 allow 状态

## Required evidence (production run)
- 每例独立 DB row + session 快照
- 最小 state diff (before/after)
- state validator 完整返回 (verified / state_written / old_state_invalid / permission set)
- 维度注入记录 (例如 sessionID 改的具体值)
