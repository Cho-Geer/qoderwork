# T-PT-042 checklist (DRY-RUN plan)

## Status
- T-PT-042: READY (not executed)
- DRY_RUN: true
- FRAMEWORK_SKILL_READ_HARD_GATE: (not set)

## Prerequisites
- T-PT-048
- T-PT-049
- T-PT-041

## Tool matrix (13 = 8 allowlist + 5 denylist)
### Allowlist (8)
- read → allow (rule: (none — allowlist 直接通过), executor counter: 1)
- glob → allow (rule: (none — allowlist 直接通过), executor counter: 1)
- grep → allow (rule: (none — allowlist 直接通过), executor counter: 1)
- config_read_attest → allow (rule: (none — allowlist 直接通过), executor counter: 1)
- question → allow (rule: (none — allowlist 直接通过), executor counter: 1)
- skill → allow (rule: (none — allowlist 直接通过), executor counter: 1)
- skill_read_attest → allow (rule: (none — allowlist 直接通过), executor counter: 1)
- rule_read_attest → allow (rule: (none — allowlist 直接通过), executor counter: 1)

### Denylist (5)
- safe_shell → deny-hard-block (rule: skill-read-attest-required, executor counter: 0)
  bypass_attempt: 尝试 'echo' (只读 shell) — 必须仍被拒,不能靠 '只读' 绕过
- safe_edit → deny-hard-block (rule: skill-read-attest-required, executor counter: 0)
  bypass_attempt: 尝试写 allowed path — 必须仍被拒
- safe_framework_edit → deny-hard-block (rule: skill-read-attest-required, executor counter: 0)
  bypass_attempt: 尝试改只读 plugin — 必须仍被拒
- safe_repo_push → deny-hard-block (rule: skill-read-attest-required, executor counter: 0)
  bypass_attempt: 尝试 push 到 fork — 必须仍被拒
- safe_quantum_compute_v9_xyz → deny-attest-required (rule: skill-read-attest-required, executor counter: 0)
  bypass_attempt: 尝试新工具名 — 必须被 default-deny 拒绝,不能因为未在 deny 矩阵就放行

## Oracle
- ORA-PT-12: 8 allowlist 通过;5 denylist 全部 default-deny 或 hard-block;不能靠 '只读 shell' 或 '未枚举工具' 绕过

## Required evidence (production run)
- 每个工具的 dispatcher 实际返回 (allow / deny + rule_id)
- executor boundary counter (allowlist 应执行, denylist 必须 = 0)
- bypass attempt 失败记录 (e.g. 'echo' 仍被拒, 'safe_quantum_compute_v9_xyz' 仍被 default-deny)
- 工具结果矩阵表格 (13 行 × 5 列)
