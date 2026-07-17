# T-PT-048 checklist (DRY-RUN plan)

## Status
- T-PT-048: READY (not executed)
- DRY_RUN: true
- FRAMEWORK_SKILL_READ_HARD_GATE: (not set)

## Prerequisites
- (none — G3 foundation)

## Fixtures (4)
- SC-T048-01-root [root]: Root identity fixture: 完整 sessionID/agent/scope/required/skill_hash → expected static_valid=true, state_validator=accept, rule_id=(n/a — accepted)
- SC-T048-02-child [child]: Child identity fixture: 含 parentSessionID + canonicalTaskScope 派生 → expected static_valid=true, state_validator=accept, rule_id=(n/a — accepted)
- SC-T048-03-hint-mismatch [hint-mismatch]: Hint mismatch: child hint.parentSessionID 与 root session 不匹配 → reject → expected static_valid=true, state_validator=reject, rule_id=skill-read-attest-required
- SC-T048-04-agent-mismatch [agent-mismatch]: Agent mismatch: agent 字段与授权 manifest 不匹配 → reject → expected static_valid=true, state_validator=reject, rule_id=skill-read-attest-required

## Oracle
- ORA-PT-13: fixture 与现役 skill-attest.ts 真实契约一致; 4 类 fixture 全部静态可验证; mismatch fixture 必被 state validator 拒绝

## Required evidence (production run)
- 静态形状校验记录 (每 fixture 字段齐全)
- 真实 attestSkillRead() 返回 (root/child → verified:true, mismatch → verified:false + ruleId)
- DB before/after (验证 state row 创建/未创建)
- session map (parent-child 关系)
- file hash 一致性 (Skill 文件未被篡改)
