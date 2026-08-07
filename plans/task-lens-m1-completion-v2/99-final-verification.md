# Task Lens M1 完工作业 v2 — Final Verification

**Plan ID**: `TASK-LENS-M1-COMPLETION-V2-PLANSET-20260806`
**Current status**: `NOT-RUN`（本轮 plan 撰写阶段；v2 蓝图仍为 DRAFT；不宣称已通过）
**First executable Phase**: `PHASE-05-v2`（等 DRAFT → READY-FOR-IMPLEMENTATION 后由独立 session 派遣）

> 本文件不是 `plans/task-lens-m1/99-final-verification.md` 的修改或替代品。两份 final verification 并存；frozen predecessor 不动。

## 1. 全局验证与证据（双端各一份）

| Level | Command（WSL 端；Git Bash 端见 §1.1） | Preconditions | Exact PASS condition | Artifacts | Current status |
|---|---|---|---|---|---|
| structural | `bun run .agents/skills/deterministic-implementation-planning/scripts/validate-plan.ts plans/task-lens-m1-completion-v2 "$(pwd)"`（USAGE 2 argv，已实测；详见 §2.1/§2.2） | PLAN_SET 完整 | errors=0 | validator JSON | planning gate only |
| governance | phase-local `capture-state.ts`（双端各） | human-approved lock | HEAD/phase/lock hash 匹配 | scope-lock/pre-change | NOT-RUN |
| component | `bun test scripts/task-lens`（双端各） | PHASE-05-v2 ACCEPTED | 0 fail；所有 mutation sensitive | test output | NOT-RUN |
| integration | `TASK_LENS_REAL_TARGETS=1 bun test scripts/task-lens/__tests__/integration.test.ts`（双端各） | PHASE-06-v2 ACCEPTED | fixtures + 2 real targets + dual case verdict | run roots/receipts | NOT-RUN |
| build | `bun run typecheck`（双端各） | 当前 HEAD 实测 EXIT=0（v2 不容忍 exit≠0） | **exit 0** | tsc output | OK（HEAD 当前状态） |
| manual | 2 cards × 2 envs + 10 feedback × 2 envs | artifacts readable | human receipts 完整 | review receipts | NOT-RUN |
| acceptance | `bun run task-lens metrics summarize --out <root> --json`（双端各） | 10 real task pairs 双端各 | gate PASS；≥7 yes/yes | metrics/summary | NOT-RUN |
| chain | `bun run scripts/validate-outcome-governance.ts plans/task-lens-outcome-v1 --repository-root "$(pwd)"`（USAGE 3 argv，已实测；详见 §2.1/§2.2） | gen2 contract human-approved | `ok: true`、`mode: structural`、`validation_kind: review-separated`、`lifecycle: ACTIVE`、errors=[] | gen2 chain files | NOT-RUN |

### 1.1 Git Bash 端命令对照
structural + chain 两端同；governance 端 `${HOME}/.local/state/...` ↔ Git Bash 端 `%LOCALAPPDATA%\...`（`mkdir -p "$LOCALAPPDATA/qoderwork/..."` 或 cygpath 转换；**禁 PowerShell**）；acceptance `--out` 与 evidence root 路径不可翻译（用 cygpath 或直接 `${HOME}`/`$LOCALAPPDATA` 切换）。

## 2. Fixed global commands

### 2.1 WSL Ubuntu-24.04 native FS

```bash
cd <WORKTREE>

# preflight (H3): confirm validator paths exist
test -f .agents/skills/deterministic-implementation-planning/scripts/validate-plan.ts
test -f scripts/validate-outcome-governance.ts
# [POST-IMPLEMENTATION; CURRENTLY NON-EXISTENT] — preflight gate on v2 test files
for f in scripts/task-lens/__tests__/metrics.test.ts \
         scripts/task-lens/__tests__/cli-integration.test.ts \
         scripts/task-lens/__tests__/integration.test.ts \
         scripts/task-lens/__tests__/closure.test.ts ; do
  test -f "$f" || { echo "BLOCKED: $f missing; [POST-IMPLEMENTATION]"; exit 1; }
done

# structural validator (argv 已实测)
bun run .agents/skills/deterministic-implementation-planning/scripts/validate-plan.ts plans/task-lens-m1-completion-v2 "$(pwd)"

# bun test [POST-IMPLEMENTATION] + real-target integration
bun test scripts/task-lens ; TASK_LENS_REAL_TARGETS=1 bun test scripts/task-lens/__tests__/integration.test.ts

# typecheck must exit 0 (v2 strict; DEC-V2-006)
set +e ; bun run typecheck ; typecheck_exit=$? ; set -e ; test "$typecheck_exit" -eq 0

git diff --check
git diff --exit-code -- bun.lock

# acceptance summary [POST-IMPLEMENTATION]
bun run task-lens metrics summarize --out "${HOME}/.local/state/qoderwork/task-lens/m1-acceptance" --json

# gen2 outcome chain validator (USAGE: directory --repository-root repository, 3 argv — 已实测)
bun run scripts/validate-outcome-governance.ts plans/task-lens-outcome-v1 --repository-root "$(pwd)"
```

### 2.2 Windows Git Bash

```bash
cd <WORKTREE>

# preflight (H3): confirm validator paths exist
test -f .agents/skills/deterministic-implementation-planning/scripts/validate-plan.ts
test -f scripts/validate-outcome-governance.ts
# [POST-IMPLEMENTATION]
for f in scripts/task-lens/__tests__/metrics.test.ts \
         scripts/task-lens/__tests__/cli-integration.test.ts \
         scripts/task-lens/__tests__/integration.test.ts \
         scripts/task-lens/__tests__/closure.test.ts ; do
  test -f "$f" || { echo "BLOCKED: $f missing; [POST-IMPLEMENTATION]"; exit 1; }
done

# structural validator
bun run .agents/skills/deterministic-implementation-planning/scripts/validate-plan.ts plans/task-lens-m1-completion-v2 "$(pwd)"

# bun test [POST-IMPLEMENTATION] + real-target integration
bun test scripts/task-lens ; TASK_LENS_REAL_TARGETS=1 bun test scripts/task-lens/__tests__/integration.test.ts

# typecheck must exit 0 (v2 strict)
set +e ; bun run typecheck ; typecheck_exit=$? ; set -e ; test "$typecheck_exit" -eq 0

git diff --check
git diff --exit-code -- bun.lock

# acceptance summary [POST-IMPLEMENTATION]
bun run task-lens metrics summarize --out "$LOCALAPPDATA/qoderwork/task-lens/m1-acceptance" --json

# gen2 outcome chain validator
bun run scripts/validate-outcome-governance.ts plans/task-lens-outcome-v1 --repository-root "$(pwd)"
```
> 两端命令形态一致，但 evidence root 路径不可翻译；任一端 non-zero / skip / missing / `UNAVAILABLE` 阻止该端 PASS；validator 只证明结构（structural + review-separated）。

## 3. Evidence ceiling rule（双端）

- Static/source inspection 仅证 analysis；PHASE-05-v2 component 不证并发/真实目标/M1 gate；PHASE-06-v2 integration 不证 10-task threshold；
- PHASE-07-v2 不运行 live LLM，不得声明 live-LLM-E2E；历史 blueprint/log evidence 不替代 v2 implementation HEAD 新观察；
- 任一端 case FAIL 不得覆盖另一端 PASS；55-pass predecessor claim 与 v1 4-case frozen outcome scope 严格区分（不可外推）；
- predecessor 状态分裂（plan-index NOT_STARTED vs LATEST ACCEPTED vs handoff BLOCKED）不再裁决（DEC-V2-009），仅作历史输入。

## 4. Cross-Phase traceability gate（双端各一份）

| Requirement | Owning Phase | Required final evidence | Advance blocker | 双端 |
|---|---|---|---|---|
| REQ-001 | PHASE-01 frozen | approved locks + pre-change receipts | approval/HEAD/hash missing | both |
| REQ-002/003/004 | PHASE-02 frozen | diff/input/safety tests | injection/path/typecheck delta | both |
| REQ-005/006/007 | PHASE-03 frozen | provider/edge/budget/spine tests | ambiguity/unavailable/overbudget | both |
| REQ-008/009/010 | PHASE-04 frozen | lcov/card/atomic tests | unbound promotion/partial artifact | both |
| REQ-011v2/012v2 | PHASE-05-v2 | 双端 lock/JSONL/recovery/CLI tests | duplicate/corrupt/coupled failure | both |
| REQ-013v2 | PHASE-06-v2 | 双端 fixture + 2 target receipts + reviews + dual case verdict | hash drift/skip/unavailable | both |
| REQ-014v2 | PHASE-07-v2 | 双端 10-task summary + gen2 chain + docs | <10/<7/typecheck≠0/audit invalid/chain corrupt | both |
| REQ-CROSS-ENV | ALL-v2 | 双端 evidence root path + dual case per REQ | cross-env reference | both |

## 5. 风险、失败收敛、回滚

| Risk | Trigger | Detection | Fixed convergence | Evidence retained | 双端 |
|---|---|---|---|---|---|
| scope drift | diff outside allowed | phase diff scan | BLOCKED；new human scope | diff/old lock | both |
| CodeGraph drift | schema/pending/ambiguity | current probe | DB→fixed CLI；仍失败 exit12 | capability/CLI output | both |
| false absence | query/evidence unavailable | three-state gates | FAIL，不取反 boolean | read/query diagnostics | both |
| coverage inflation | no matching companion | TL-COV-BIND | all unknown+exit2 | lcov/companion hashes | both |
| partial artifact | fsync/rename failure | read-back/hash | exit21；保留未知 final | staging/final report | both |
| metrics race | lock timeout/bad line | full parse/owner | exit21；不删锁/truncate | owner/JSONL | both |
| target contamination | before/after differs | TL-ZERO-WRITE-v2 | stop；不修改目标恢复 | both snapshots | both |
| feedback bias | duplicate/copied task | unique/input hash gate | exclude and report；不删原始事件 | selection receipt | both |
| typecheck residual | root tsc non-zero | TL-TYPECHECK-v2 | 不容忍 exit≠0；report 不绕过 | full tsc output | both |
| audit invalid | gen2 chain validator failure | validate-outcome-governance.ts | structural-only 不证真实执行；ERRORS 报告 INVALID/BLOCKED | audit/errors | both |
| cross-env evidence pollution | copy WSL evidence to Git Bash path | TL-DUAL-CASE-v2 | revert；重新采集；独立 root | 双端 evidence | 跨端 |
| v1 chain tampering | gen2 ledger overrides v1 ledger | ledger sha diff | 恢复 v1；新建 gen2 chain（hash-only ref） | ledger | n/a |
| INDEX sync deferred | v2 blueprint APPROVED 后 INDEX 未登记 | INDEX diff scan | 报告 blocker；不冒充 DONE | INDEX diff | n/a |
| self-created outcome-run-result.gitbash.json | 实施阶段误建 | validator structural check | validator 拒绝；立即停止；删除自创文件 | validator output | n/a |

### 5.1 Rollback convergence（双端）

仅回滚当前 Phase allowed-files；保留 plans/locks/receipts/tests/evidence；禁 hard reset、删用户改动、递归删 unresolved path、改目标恢复 hash；产品回滚须 Human 批准，按 inventory 逐文件；不删 acceptance/evidence；回滚后重跑 owning tests、typecheck、diff/bun.lock checks；双端任一 FAIL → 整体 verdict FAIL；撤销 gen2 chain 创建（仅删 gen2 文件）；v2 plan 保留；不动 v1。

## 6. Final completion gate

- [ ] 每个 index requirement 由 v2 successor phase 拥有；与 frozen predecessor REQ 编号体系不冲突（v2 用 `REQ-XXXv2` 命名）；
- [ ] PHASE-05/06/07-v2 双端 completion gates 全部有当前 evidence；
- [ ] Phase execution 严格遵循 manifest dependency order；
- [ ] 每个 v2 code Phase 有双端 human-approved scope-lock 和 pre-change receipt；
- [ ] 每个 shared function 的 caller tests 已纳入 fixed verification，fake 与真实路径区分；
- [ ] 每个 negative check 区分 FOUND/NOT_FOUND/UNAVAILABLE 且 mutation sensitive；
- [ ] `bun test scripts/task-lens` 与 real-target integration 双端均无 skip/失败；
- [ ] work-one / qoderwork-main 双端 before/after status/tree hashes 相等；
- [ ] 双端 `bun run typecheck` exit 0（v2 比 predecessor 严格，DEC-V2-006；当前 HEAD 实测 EXIT=0，约束可达）；
- [ ] 双端各 10 unique task pairs、10 feedback、≥7 yes/yes，sensitivity control 双端 PASS；
- [ ] 双端 `validate-outcome-governance.ts plans/task-lens-outcome-v1 --repository-root "$(pwd)"` exit 0，输出 `mode: structural` / `validation_kind: review-separated` / `lifecycle: ACTIVE`；
- [ ] gen2 outcome chain（contract-v2/spec-v2/bundle-v2/amendment-v2/approval-v2/ledger event-003+004/runs/outcome-run-result-v2）置于 `plans/task-lens-outcome-v1/` 同目录；ledger event-003.previous_event SHA 引用 v1 event-002（hash-only，不修改 v1）；
- [ ] 双端 case verdict 独立汇总到单一 canonical outcome-run-result-v2.json；任一 case FAIL = 整体 FAIL；
- [ ] blueprint / documents index / implementation log / logs index 状态一致（INDEX 同步是 blocker，非本 plan 解决）；
- [ ] No lower-level result is reported as a higher-level PASS；
- [ ] v2 不修改 frozen predecessor；v2 不冒充 v1 已存在的 approval/receipt/run PASS；
- [ ] 不可执行命令全部标 `[POST-IMPLEMENTATION; CURRENTLY NON-EXISTENT]` + preflight `test -f`；
- [ ] 55-pass predecessor 历史 claim 与 v1 4-case frozen outcome 严格区分；predecessor 状态分裂不再裁决（DEC-V2-009）；
- [ ] `validate-audit.ts` 与 P-01..P-07 v2.1 audit 模板不在 v2 引用范围内。

**Final status rule**（v2）：任一未勾选项 → v2 PLAN_SET incomplete；`IMPLEMENTED-AND-GATE-PASS` 只允许全部勾选 + 双端 receipts + gen2 chain 后写入；INDEX 同步完成后才可登记 `blueprints/INDEX.md` 活跃段。

## 7. 本轮 plan 撰写阶段的 self-check（本文件级别）

- [x] 状态标为 NOT-RUN（plan 撰写阶段，不宣称已通过）；
- [x] 双端命令分别列出（含 `${HOME}` / `${LOCALAPPDATA}` 差异 + mkdir 路径契约 + 禁 PowerShell）；
- [x] evidence ceiling rule 明确禁止升级；
- [x] cross-phase traceability 区分 frozen predecessor 与 v2 successor；
- [x] 风险/收敛/回滚覆盖双端 + 跨端 + v1 chain + INDEX sync + self-created gitbash.json；
- [x] final completion gate 19 条勾选项；
- [x] gen2 chain 接入约束（ledger event-003.previous_event = v1 ledger event-002 SHA hash-only）写明；
- [x] INDEX 同步是 blocker 显式声明；
- [x] 所有 `bun run <script>` / `bun test <file>` 命令路径 `test -f` preflight 通过或标 `[POST-IMPLEMENTATION]`；
- [x] validate-plan.ts / validate-outcome-governance.ts argv 契约已实测并写入 §1 + §2；
- [x] typecheck exit 0 硬约束（DEC-V2-006；predecessor exit=1 容忍已删除）；
- [x] `validate-audit.ts` 与 P-01..P-07 v2.1 audit 模板不引用（改用 `validate-outcome-governance.ts`）；
- [x] 双 case per REQ 汇总到单一 canonical run-result（不允许 `outcome-run-result.gitbash.json`）；
- [x] legacy `audits/**` 禁止作为 evidence root 引用 / 不得写入（DEC-V2-010；仅允许 historical input Read frozen LATEST.md）。
- [x] v1 ledger frozen-immutable integrity（gen2 chain 仅 hash-only 引用，禁 override）。