# T-PT-049 checklist (DRY-RUN plan)

## Status
- T-PT-049: READY (not executed)
- DRY_RUN: true
- FRAMEWORK_SKILL_READ_HARD_GATE: (not set)

## Prerequisites
- T-PT-048

## Subcases (4)
- SC-T049-01-root-lifecycle [root-lifecycle]: Root lifecycle: 完整 attest → write tool → verified:true → expected verified=true, rule=(none — allowed)
- SC-T049-02-child-lifecycle [child-lifecycle]: Child lifecycle: spawn child → attest → write tool → verified:true → expected verified=true, rule=(none — allowed)
- SC-T049-03-writer-trace [writer-trace]: Writer trace: 写工具 executor trace 显示 skill-policy 在前 + 专用 ruleId 命中 → expected verified=false, rule=skill-read-attest-required
- SC-T049-04-validator-trace [validator-trace]: Validator trace: state validator 4 维身份校验逐一执行 → expected verified=false, rule=skill-read-attest-required

## Oracles (5)
- oracle-1 [ORA-PT-11]: canonical identity 完整 (sessionID/agent/scope/required/file_hash) → verified:true → verified:true, state_written:true
- oracle-2 [ORA-PT-11]: sessionID mismatch → verified:false → verified:false, ruleId='skill-read-attest-required'
- oracle-3 [ORA-PT-13]: required list 非空 + 全部 Skill 存在 → verified:true → verified:true
- oracle-4 [ORA-PT-13]: file hash 与 Skill 实际 hash 不一致 → verified:false → verified:false, ruleId='skill-read-attest-required'
- oracle-5 [ORA-PT-11/13]: state_written:true 才能在后续 reader 中被查到 (持久化 round-trip) → reader 返回与 writer 一致的 state row

## Oracle coverage
- SC-T049-01 (root lifecycle)        → oracle-1, oracle-3, oracle-5
- SC-T049-02 (child lifecycle)       → oracle-1, oracle-3, oracle-5
- SC-T049-03 (writer trace)           → oracle-2, oracle-4
- SC-T049-04 (validator trace)        → oracle-1..5 (全维度逐一注入)

## Required evidence (production run)
- handler chain trace (skill-policy 在 safe-edit-gate 之前)
- DB before/after (state row 创建/读取)
- session map (parent-child 关系)
- file hash 一致性
- 5 oracle 注入场景完整记录
