# ADV-PT-008 charter checklist (DRY-RUN plan)

## Status
- ADV-PT-008: READY (not executed)
- DRY_RUN: true
- FRAMEWORK_SKILL_READ_HARD_GATE: (not set)

## Prerequisites
- T-PT-048
- T-PT-049
- T-PT-050

## Mutations (5)
- mutate_delete_throw: 在 skill-policy.ts 的 hard_block 分支删除专用 throw (硬门 throw 不再抛出，错误被静默吞掉)
- mutate_catch_swallows: 把 skill-policy.ts 的 try/catch 改为 swallow 模式，catch 后 return { allowed: true }（异常被吞）
- mutate_unknown_tool_default_allow: 把未知工具的 default 从 deny 改为 allow（safe_edit/safe_shell/未列入的工具默认放行）
- mutate_remove_shell_from_deny_matrix: 从 deny 矩阵移除 safe_shell / safe_framework_edit / safe_repo_push / github_mcp write（这 4 个被默许）
- mutate_db_write_failure_trusted: DB 写失败 (state_written=false) 后，state validator 仍信任旧状态为有效 allow

## Tool matrix (14)
- [allowlist] read → allow
- [allowlist] glob → allow
- [allowlist] grep → allow
- [allowlist] list → allow
- [allowlist] question → allow
- [allowlist] skill → allow
- [allowlist] skill_read_attest → allow
- [allowlist] skill_read_state → allow
- [deny-mandatory] safe_shell → deny-hard-block
- [deny-mandatory] safe_framework_edit → deny-hard-block
- [deny-mandatory] safe_repo_push → deny-hard-block
- [unknown] future_tool_xyz_2027 → deny-attest-required
- [mutation-specific] github_mcp_create_issue → deny-hard-block
- [mutation-specific] safe_edit → deny-hard-block

## Required evidence (production run)
- mutation report (mutant survived / killed)
- active dispatcher trace (handler order + reject events)
- tool matrix results (14 entries, executor entry=0 for non-allowlist)
- zero-execution evidence (real executor counter)
