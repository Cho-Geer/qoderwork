# Task Lens M1 确定性实施计划 — Final Verification

**Plan ID**: `TASK-LENS-M1-PLANSET-20260723`
**Current status**: `NOT-RUN`
**First executable Phase**: `PHASE-01`

## 7. Global verification and evidence

| Level | Command | Preconditions | Exact PASS condition | Artifacts | Current status |
|---|---|---|---|---|---|
| structural | `bun run .agents/skills/deterministic-implementation-planning/scripts/validate-plan.ts plans/task-lens-m1` | PLAN_SET 完整 | errors=0 | validator JSON | planning gate only |
| governance | phase-local `capture-state.ts` | human-approved lock | HEAD/phase/lock hash匹配 | scope-lock/pre-change | NOT-RUN |
| component | `bun test scripts/task-lens` | PHASE-02~05 accepted | 0 fail；所有 mutation sensitive | test output | NOT-RUN |
| integration | `TASK_LENS_REAL_TARGETS=1 bun test scripts/task-lens/__tests__/integration.test.ts` | PHASE-05 accepted；2 indexes up-to-date | fixtures+2 real targets PASS | run roots/receipts | NOT-RUN |
| build | `bun run typecheck` | BASELINE-TS-001 已由所有者清零 | exit0 | tsc output | BLOCKED |
| manual | 2 cards + 10 feedback reviews | artifacts readable | human receipts 完整 | review receipts | NOT-RUN |
| acceptance | `bun run task-lens metrics summarize --out /home/zhaoge/.local/state/qoderwork/task-lens/m1-acceptance --json` | 10 real task pairs | gate PASS；≥7 yes/yes | metrics/summary | NOT-RUN |
| audit | `validate-audit.ts audits/task-lens-m1/2026-07-23-m1-acceptance-audit.md` | EV receipts complete | valid=true/errors=[] | audit/LATEST | NOT-RUN |

### Fixed global command

```bash
cd /home/zhaoge/workspace/qoderwork/.worktrees/check-plan
bun run .agents/skills/deterministic-implementation-planning/scripts/validate-plan.ts plans/task-lens-m1
bun test scripts/task-lens
TASK_LENS_REAL_TARGETS=1 bun test scripts/task-lens/__tests__/integration.test.ts
bun run typecheck
git diff --check
git diff --exit-code -- bun.lock
bun run task-lens metrics summarize --out /home/zhaoge/.local/state/qoderwork/task-lens/m1-acceptance --json
bun run .agents/skills/plan-audit-archiver/scripts/validate-audit.ts audits/task-lens-m1/2026-07-23-m1-acceptance-audit.md
```

- non-zero、skip、missing 或 `UNAVAILABLE` 均阻止 PASS；validator 只证明结构。

### Sizing warning disposition

- Index=7,999 chars：已逆审；其内容仅为不可再拆的全局 source/decision/trace/inventory/manifest。7 个 Phase 均低于 10,500 chars、可独立执行，不要求弱模型加载 index 合并本地合同。故保留该 warning，不删除 contract。

### Evidence preservation

- Governance 保留 scope-lock、pre-change、EV、verdict-state。
- Integration/acceptance 保留 state 目录内 receipts、graph、card、metrics、snapshots、输出与 hashes。
- 失败不覆盖：禁止 in-place retry、覆盖 taskId、编辑负 feedback/JSONL。

### Evidence ceiling rule

- Static/source inspection 只证明 analysis。
- PHASE-02~04 component 不证明并发/真实目标/M1 gate。
- PHASE-05 integration 不证明双目标零写；PHASE-06 不证明 10-task threshold。
- PHASE-07 不运行 live LLM；不得声明 live-LLM-E2E。
- 历史 blueprint/log evidence 不替代 implementation HEAD 上的新观察。

### Cross-Phase traceability gate

| Requirement | Owning Phase | Required final evidence | Advance blocker |
|---|---|---|---|
| REQ-001 | PHASE-01 | approved locks + pre-change receipts | approval/HEAD/hash missing |
| REQ-002/003/004 | PHASE-02 | diff/input/safety tests | injection/path/typecheck delta |
| REQ-005/006/007 | PHASE-03 | provider/edge/budget/spine tests | ambiguity/unavailable/overbudget |
| REQ-008/009/010 | PHASE-04 | lcov/card/atomic tests | unbound promotion/partial artifact |
| REQ-011/012 | PHASE-05 | lock/JSONL/recovery/CLI tests | duplicate/corrupt/coupled failure |
| REQ-013 | PHASE-06 | fixture+2 target receipts+reviews | hash drift/skip/unavailable |
| REQ-014 | PHASE-07 | 10-task summary+audit+docs | <10/<7/typecheck/audit invalid |

## 8. Risks, failure convergence, and rollback

| Risk | Trigger | Detection | Fixed convergence | Evidence retained |
|---|---|---|---|---|
| scope drift | diff outside allowed | phase diff scan | BLOCKED；new human scope | diff/old lock |
| CodeGraph drift | schema/pending/ambiguity | current probe | DB→fixed CLI；仍失败 exit12 | capability/CLI output |
| false absence | query/evidence unavailable | three-state gates | FAIL，不取反 boolean | read/query diagnostics |
| coverage inflation | no matching companion | TL-COV-BIND | all unknown+exit2 | lcov/companion hashes |
| partial artifact | fsync/rename failure | read-back/hash | exit21；保留未知 final | staging/final report |
| metrics race | lock timeout/bad line | full parse/owner | exit21；不删锁/truncate | owner/JSONL |
| target contamination | before/after differs | TL-ZERO-WRITE | stop；不修改目标恢复 | both snapshots |
| feedback bias | duplicate/copied task | unique/input hash gate | exclude and report；不删原始事件 | selection receipt |
| baseline TS debt | root tsc non-zero | TL-TYPECHECK | owner resolves outside Phase scope | full tsc output |
| audit invalid | receipt/validator failure | validate-audit | INVALID/BLOCKED；禁止签署 | audit/errors |

### Rollback convergence

1. 只回滚当前 Phase allowed files；保留 plans/locks/receipts/tests/evidence。
2. 禁止 hard reset、删除用户改动、递归删除 unresolved path、修改目标恢复 hash。
3. 产品回滚须 Human 批准，按 inventory 逐文件；不删 acceptance/evidence。
4. 回滚后重跑 owning tests、typecheck、diff/bun.lock checks。

## 9. Final completion gate

- [ ] Every index requirement is owned by exactly one Phase。
- [ ] PHASE-01~07 completion gates 全部有当前 evidence。
- [ ] Phase execution 严格遵循 manifest dependency order。
- [ ] 每个 code Phase 有 human-approved scope-lock 和 pre-change receipt。
- [ ] 每个 shared function 的 caller tests 已纳入 fixed verification，fake 与真实路径区分。
- [ ] 每个 negative check 区分 FOUND/NOT_FOUND/UNAVAILABLE 且 mutation sensitive。
- [ ] `bun test scripts/task-lens` 与 real-target integration 均无 skip/失败。
- [ ] work-one/qoderwork-main before/after status/tree hashes 相等。
- [ ] root `bun run typecheck` exit0；BASELINE-TS-001 已关闭而非忽略。
- [ ] 10 unique task pairs、10 feedback、≥7 yes/yes，sensitivity control PASS。
- [ ] validate-audit exit0，前序 BLOCKED continuity 与 P-05 声明完整。
- [ ] Blueprint、documents index、implementation log、logs index 状态一致。
- [ ] No lower-level result is reported as a higher-level PASS。

**Final status rule**: 任一未勾选项使 PLAN_SET incomplete；`IMPLEMENTED-AND-GATE-PASS` 只允许在全部勾选并附 receipts 后写入。
