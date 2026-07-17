# T-PT-039 checklist (DRY-RUN plan)

## Status
- T-PT-039: READY (not executed)
- DRY_RUN: true
- FRAMEWORK_SKILL_READ_HARD_GATE: (not set)

## Prerequisites
- T-PT-048
- T-PT-049

## Subcases (6)
- SC-T039-01-happy: Happy path: 完整 shared identity + DB write 成功 → expected verified=true, state_written=true, old_state_invalid=false
- SC-T039-02-empty-list: Empty required list: required=[] → deny → expected verified=false, state_written=false, old_state_invalid=true
- SC-T039-03-missing-identity: Missing identity: session/agent/scope 任一缺失 → deny → expected verified=false, state_written=false, old_state_invalid=true
- SC-T039-04-child-hint-mismatch: Child hint mismatch: root session 标识 vs child session 标识不一致 → deny → expected verified=false, state_written=false, old_state_invalid=true
- SC-T039-05-db-write-fail: DB write 失败: state_written=false → deny + 旧状态失效 → expected verified=false, state_written=false, old_state_invalid=true
- SC-T039-06-stale-state: Stale state: 之前写过的 old state 在新一次写失败后不可用 → expected verified=false, state_written=false, old_state_invalid=true

## Oracle
- ORA-PT-11/13: 共享 identity 完整 + DB 原子写成功 → verified:true, state_written:true;其他路径 → false, 旧状态失效

## Required evidence (production run)
- state before/after (DB row diff)
- session map (root + child identity 一致性)
- file hash (Skill 文件未被 mock)
- attestSkillRead() 返回值 (verified / state_written / old_state_invalid)
- 故障注入: DB throw / connection drop (SC-T039-05,06)
