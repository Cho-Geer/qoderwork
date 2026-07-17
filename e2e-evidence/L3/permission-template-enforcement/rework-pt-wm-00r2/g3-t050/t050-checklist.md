# T-PT-050 checklist (DRY-RUN plan)

## Status
- T-PT-050: READY (not executed)
- DRY_RUN: true
- FRAMEWORK_SKILL_READ_HARD_GATE: (not set)

## Prerequisites
- T-PT-048
- T-PT-049

## Subcases (3)
- SC-T050-01-config-only [config-only]: Config-only: skill-policy.ts 文件 + opencode.json 注册齐全 → expected disposition=allow, executor=0, rule=(n/a — config check)
- SC-T050-02-un-auth-deny [un-auth-deny]: Un-auth deny: 未授权 session 调写工具必被拒 (executor entry=0) → expected disposition=deny-hard-block, executor=0, rule=skill-read-attest-required
- SC-T050-03-auth-pass [auth-pass]: Auth-pass: 已授权 session 调写工具必通过 (executor entry=1) → expected disposition=allow, executor=1, rule=(n/a — allowed)

## Oracles (5)
- oracle-1 [ORA-PT-12]: opencode.json 中 plugin 数组包含 .opencode/plugins/before/skill-policy.ts 路径 → plugin[].path 或 plugin[].url 命中 skill-policy.ts
- oracle-2 [ORA-PT-12]: skill-policy.ts 文件存在 + 包含 hardBlock throw + DENY_MATRIX → file exists + 'hardBlock' substring + 'DENY_MATRIX' substring
- oracle-3 [ORA-PT-13]: 未授权 session safe_edit → rejected + executor entry=0 → ruleId='skill-read-attest-required', executor=0
- oracle-4 [ORA-PT-13]: 未授权 session safe_shell 'echo' → rejected (不能靠'只读'绕过) → ruleId='skill-read-attest-required', executor=0 (bypass attempt failed)
- oracle-5 [ORA-PT-13]: 已授权 session safe_edit → allowed + executor entry=1 → executor=1, no ruleId

## Oracle coverage
- SC-T050-01 (config-only)     → oracle-1, oracle-2
- SC-T050-02 (un-auth-deny)    → oracle-3, oracle-4
- SC-T050-03 (auth-pass)       → oracle-5

## Required evidence (production run)
- skill-policy.ts 存在 + 关键字符串
- opencode.json plugin 注册
- dispatcher 实际拒绝/允许事件
- executor boundary counter (3 个 subcase 各自)
- bypass attempt 失败记录 (safe_shell 'echo' 仍被拒)

## Important constraint
- SC-T050-01 仅做 read-only 文件检查, **不修改 work-one 任何文件**
