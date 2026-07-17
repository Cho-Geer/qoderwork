# ADV-PT-009 checklist (DRY-RUN plan)

## Status
- ADV-PT-009: READY (not executed)
- DRY_RUN: true
- FRAMEWORK_SKILL_READ_HARD_GATE: (not set)

## Prerequisites
- T-PT-048
- T-PT-049
- T-PT-050

## Mutations (12)

### State replay (5)
- mutate_session: 把 session-A 的合法 attestation state 复制到 session-B 复用 → kill: sessionID mismatch 失效旧状态 (ORA-PT-11)
- mutate_agent: 保持 session 不变，改 agent label (Orchestrator → build) 复用 state → kill: agent mismatch 失效旧状态 (ORA-PT-11)
- mutate_canonical_scope: 改 task_scope_id (root/child) → kill: canonical scope mismatch (ORA-PT-11)
- mutate_required_list: attest 通过后把 required_list 改短/加项/换顺序 → kill: required-set mismatch (ORA-PT-11)
- mutate_file_hash: 改 Skill 文件 hash，复用旧 state → kill: file-hash mismatch 失效旧状态 (ORA-PT-11)

### Fault injection (4)
- db_read_error: DB 读返回错误 (SqliteError) → kill: fail-closed, 未认证调用被拒
- db_write_error: DB 写返回 false / SqliteError → kill: state_written=false → 不返回 verified:true
- corrupt_state: DB row 损坏 (缺字段/类型错/JSON 解析失败) → kill: parser 拒绝, 旧有效状态不复活
- lock_conflict: DB 写时锁冲突 (SQLITE_BUSY) → kill: 回退 fail-closed, 不留 partial success

### Concurrency (3)
- interleave_attestation: session-A attest 过程中 session-B 插队 attest + 写工具调用 → kill: 跨边界借用被拒
- parallel_attestation: 两个 session 同时做 attestation (同一 task scope) → kill: 无双写/partial success; winner-take-all
- repeated_attestation: 同一 session 重复 attest 20 次 → kill: 不扩大权限; 旧 attest 不被新覆盖

## Schedule (20 rounds)

| Round | Seed | Operations | Expected | Assertions |
|---|---|---|---|---|
| 1-5 | 0xcafe0001-05 | 5 state_replay ops/round (rotating sessions A/B/C) | all-deny | ORA-PT-11, ORA-PT-12 |
| 6-10 | 0xcafe0006-0a | 4 fault_injection ops/round (rotating sessions) | all-deny | ORA-PT-11, ORA-PT-12 |
| 11-15 | 0xcafe000b-0f | 3 concurrency ops/round (rotating target session) | winner-only | ORA-PT-11, ORA-PT-12 |
| 16-20 | 0xcafe0010-14 | 6 mixed ops/round (state_replay + fault + concurrency) | no-amplification | ORA-PT-11, ORA-PT-12 |

**Schedule detail**: 见 [adv009-schedule.md](./adv009-schedule.md)（192 行完整 20 轮）

## Oracles (2)
- ORA-PT-11: 每个 mutation 的 kill_condition 被 state validator 正确触发（sessionID/agent/scope/required-set/file-hash mismatch → deny）
- ORA-PT-12: 未认证 session 调用非 allowlist 工具被 hard-block（disposition=deny-hard-block, executor=0）

## Oracle coverage
- Round 1-5 (state_replay)   → ORA-PT-11 (identity mismatch), ORA-PT-12 (hard-block)
- Round 6-10 (fault_injection) → ORA-PT-11 (fail-closed), ORA-PT-12 (hard-block)
- Round 11-15 (concurrency)  → ORA-PT-11 (no cross-boundary), ORA-PT-12 (hard-block)
- Round 16-20 (mixed)        → ORA-PT-11 (no amplification), ORA-PT-12 (hard-block)

## Required evidence (production run)
- 每轮 DB before/after state snapshot
- 每个 mutation op 的 reject event (ruleId + disposition)
- fault injection 的 fake adapter contract 验证
- concurrency round 的 scheduler trace (interleave/parallel timing)
- executor boundary counter=0 对所有 deny 路径
- 20 轮 × assertion pass/fail 矩阵

## Important constraint
- 不修改 work-one 任何源码；mutation 是 plan-only
- 需 reviewer 接受临时 mutation + 24h revert
- 需 reviewer 启动隔离 serve + seed DB state for 3 sessions
- fake adapter contract 需先通过独立测试再注入 round
- §1.1 #5 主动轮询 /question + #6 reply
