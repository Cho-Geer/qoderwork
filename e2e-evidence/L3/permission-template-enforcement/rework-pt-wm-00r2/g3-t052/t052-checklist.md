# T-PT-052 checklist (DRY-RUN plan)

## Status
- T-PT-052: READY (not executed)
- DRY_RUN: true
- FRAMEWORK_SKILL_READ_HARD_GATE: (not set)

## Prerequisites
- T-PT-048
- T-PT-049
- T-PT-050

## Mutation Fixtures (8)
- mut-attest-fail-allow [always-allow]: attestSkillRead 改为始终 allow (return verified:true unconditionally)
  target: .opencode/skills/skill-attest.ts:attestSkillRead()
  expected_outcome: still-reject
- mut-skip-file-hash-check [skip-check]: state validator 跳过 file hash 检查 (return true 不比对 hash)
  target: .opencode/skills/skill-attest.ts:validateFileHashes()
  expected_outcome: still-reject
- mut-skip-agent-check [skip-check]: state validator 跳过 agent 检查
  target: .opencode/skills/skill-attest.ts:validateAgent()
  expected_outcome: still-reject
- mut-skip-scope-check [skip-check]: state validator 跳过 canonicalTaskScope 检查
  target: .opencode/skills/skill-attest.ts:validateCanonicalTaskScope()
  expected_outcome: still-reject
- mut-trust-stale-state [trust-stale]: state validator 信任 stale state (不检查 sessionID)
  target: .opencode/skills/skill-attest.ts:validateSessionID()
  expected_outcome: still-reject
- mut-silent-catch-error [silent-catch]: state validator 静默吞 DB 错误 (catch → return verified:true)
  target: .opencode/skills/skill-attest.ts:validateStateFromDB() — catch block
  expected_outcome: fail-closed
- mut-write-without-tx [no-tx]: DB 写缺事务包裹 (no BEGIN/COMMIT)
  target: .opencode/skills/skill-attest.ts:dbWriteSubState()
  expected_outcome: fail-closed
- mut-allow-unknown-tool [default-allow]: 未知工具默认 allow (删去 else deny 分支)
  target: .opencode/plugins/before/skill-policy.ts:isAllowlisted()
  expected_outcome: still-reject

## Oracles (4)
- oracle-1 [ORA-PT-02]: 全部 8 mutation 在隔离 serve 中被 kill (无 mutant 存活) → 8/8 mutation killed, 0 survived
- oracle-2 [ORA-PT-11]: 身份类 mutation (1, 2, 3, 4) kill 后 verified:false → mut-attest-fail-allow / skip-file-hash / skip-agent / skip-scope 都触发 verified:false
- oracle-3 [ORA-PT-12]: skill-policy 类 mutation (5, 8) kill 后 dispatcher 仍拒 → mut-trust-stale-state / mut-allow-unknown-tool 都触发 dispatcher 拒 (ruleId='skill-read-attest-required')
- oracle-4 [ORA-PT-13]: DB lifecycle 类 mutation (6, 7) kill 后 fail-closed → mut-silent-catch-error / mut-write-without-tx 都触发 state_written=false → fail-closed

## Oracle coverage
- oracle-1 (ORA-PT-02)        : 全部 8 mutation 全 kill
- oracle-2 (ORA-PT-11)        : 4 身份类 mutation (1, 2, 3, 4) kill
- oracle-3 (ORA-PT-12)        : 2 policy 类 mutation (5, 8) kill
- oracle-4 (ORA-PT-13)        : 2 DB lifecycle 类 mutation (6, 7) kill

## Required evidence (production run)
- 每 mutation 的 24h-revert 临时 diff
- cold restart 前后 dispatcher 行为对比
- survived/killed verdict (8 行)
- oracle 注入场景记录 (4 行)
- **重要**: 每次 mutation 后必须 cold restart serve (HMR 命中会让结果失真)

## Important constraint
- 不修改 work-one 任何文件 (在隔离 worktree 中做 mutation)
- 每个 mutation 必须有 24h revert timer
