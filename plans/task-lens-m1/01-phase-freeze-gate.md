# Phase PHASE-01: 冻结范围与当前基线 `[ANALYSIS→VERIFICATION]`

**Phase ID**: `PHASE-01`
**Depends on**: NONE
**Outcome**: PHASE-02 获得 human-approved scope-lock、HEAD-bound pre-change receipt 与可比较的 typecheck 基线。
**Evidence level**: component（governance-only；仅证明 Freeze Gate 产物，不证明产品行为）
**Progression status**: `ACCEPTED`
**Completion receipt**: `../../audits/task-lens-m1/evidence/progression-receipt-PHASE-01.json`

## Goal

- 在任何 `package.json` 或 `scripts/task-lens/**` 写入前完成 P-02 Freeze Gate；agent 不得填写或伪造 human approval。

## Starting state and dependency

- Required status: `plans/task-lens-m1/` 已通过结构校验，`scripts/task-lens/` 不存在。
- Required evidence: `git status --short`、`git rev-parse HEAD`、根 typecheck 输出。
- If absent: `BLOCKED`, do not continue。

## Local requirements

### REQ-001

| Requirement | Condition | Required behavior | Observable result |
|---|---|---|---|
| REQ-001 | PHASE-02 写代码前 | auditor 冻结精确 scope，Human reviewer 批准 | approval 四字段非占位且 actor_type=HUMAN |
| REQ-001-A | approval 后 | capture-state 绑定当前 HEAD/lock hash | receipt 非空、JSON 可解析、phase_id=PHASE-02 |
| REQ-001-B | 当前 typecheck 非绿 | 保存完整输出与 exit code | 只允许 BASELINE-TS-001，不写成 PASS |
| REQ-001-C | CodeGraph 指向其他 worktree | 记录 fallback 与 scan output hash | impact_analysis 不伪称已索引 |

## Allowed files

| Exact path | Change | Exact symbol/anchor |
|---|---|---|
| `audits/task-lens-m1/scope-lock-PHASE-02.json` | add by auditor, approve by human | whole JSON |
| `audits/task-lens-m1/evidence/pre-change-PHASE-02.json` | add by `capture-state.ts` | whole JSON |
| `audits/task-lens-m1/evidence/typecheck-baseline-PHASE-02.txt` | add | command output + exit marker |

## Forbidden files and behaviors

- 禁止修改 `package.json`、`scripts/**`、blueprint、plan Phase 文件或 work-one。
- 禁止 agent 把 `approval.status` 改为 `APPROVED`、填写 `approved_by` 或伪造人类证据。
- 禁止删除/隐藏用户 dirty changes，禁止用新 commit 改写 implementation base。

## Fixed contract

- API/signature: `.agents/skills/plan-audit-archiver/templates/scope-lock-template.json` schema 1.0。
- Fields/states/check names: `scope.status="FROZEN"`、`scope.provenance_level="v2.1-required"`、`approval.status="APPROVED"`、`approval.actor_type="HUMAN"`、`impact_analysis.modified_functions=[]`、`shared_functions=[]`、`caller_files=[]`、`caller_tests=[]`。
- `plan_sources` 必须列 `00-plan-index.md` 与 `02-phase-input-safety-diff.md` 的真实 sha256。
- `repository_scope.allowed_paths` 必须等于 PHASE-02 Allowed files；forbidden 至少含 `bun.lock`、`scripts/_b1_live.ts`、`/home/zhaoge/workspace/opencode/work-one`。
- Error/missing evidence behavior: 任一占位、approval 非 HUMAN、receipt 缺失/损坏/HEAD 不同均为 `TL-FREEZE=FAIL`。
- Negative states: `FOUND / NOT_FOUND / UNAVAILABLE`；CodeGraph worktree mismatch 为 `UNAVAILABLE`，只能用已记录的 `rg` fallback，不得记 `NOT_FOUND`。
- Current vs historical source: receipt 的 `head/captured_at/status_entries` 是当前证据；blueprint/log 不是 pre-change 证据。

## Implementation steps

```text
1. 在 qoderwork worktree 运行 git status、HEAD、CodeGraph status 与根 typecheck；保留完整输出。
2. auditor 从模板创建 scope-lock-PHASE-02.json，替换全部 REPLACE_*；立即执行 test-s/wc/无占位断言，通过后才交 Human。
3. 对 PHASE-02 的 8 个 Allowed files 执行 caller scan。当前 task-lens 文件不存在时，记录 querySucceeded=true、targetState=NOT_FOUND；CodeGraph worktree mismatch 单独记 UNAVAILABLE。
4. Human reviewer 审查并亲自填写 approval；立即重跑 scope-lock 三联完整性门。agent 不得代填。
5. approval 完成后运行 capture-state.ts；禁止复用已有输出路径。
6. 验证 lock、receipt、typecheck baseline 非空/可解析/内容匹配；任一失败停止。
7. 只有 TL-FREEZE 全部 PASS 才允许 PHASE-02。
```

## Check Registry

| Check name | Source of truth | Read/operation | PASS | Missing/corrupt behavior | Exact failure result |
|---|---|---|---|---|---|
| TL-FREEZE-SCOPE | scope-lock JSON | Bun JSON parse | 仅 REQ-002/003/004、8 allowed paths | parse/placeholder FAIL | `failedChecks=["TL-FREEZE-SCOPE"]` |
| TL-FREEZE-HUMAN | approval object | exact field compare | APPROVED+HUMAN+name/time/evidence | empty/agent FAIL | `failedChecks=["TL-FREEZE-HUMAN"]` |
| TL-FREEZE-HEAD | receipt | compare HEAD/realpath/phase/hash | 全相等 | missing/mismatch FAIL | `failedChecks=["TL-FREEZE-HEAD"]` |
| TL-FREEZE-TSC | baseline text | parse exit/diagnostics | exit=1 且仅 BASELINE-TS-001 | extra/empty FAIL | `failedChecks=["TL-FREEZE-TSC"]` |
| TL-FREEZE-IMPACT | impact_analysis | inspect scan command/hash | mismatch显式且 fallback 完整 | empty/伪 NOT_FOUND FAIL | `failedChecks=["TL-FREEZE-IMPACT"]` |

## All-pass Fixture

| Evidence object | Creation method | Required fields/data | Why required |
|---|---|---|---|
| approved scope-lock | auditor + Human reviewer | 真实 plan hashes、scope、approval | 冻结边界 |
| typecheck baseline | fixed command | TS2307 路径、exit 1 | 差分门 |
| pre-change receipt | capture-state CLI | schema/realpath/PHASE-02/HEAD/lock hash/status | provenance |
| caller scan | `rg` fallback | command、exit、output hash、三态 | impact gate |

## Single-failure Matrix

| Test ID | Baseline | Only mutation | Expected check | Exact failedChecks/error | Other checks |
|---|---|---|---|---|---|
| TL-P-001 | all-pass fixture | approval.actor_type=`AGENT` | TL-FREEZE-HUMAN | exact singleton | true |
| TL-P-002 | all-pass fixture | receipt.head 改 1 hex | TL-FREEZE-HEAD | exact singleton | true |
| TL-P-003 | all-pass fixture | typecheck 增加第二诊断 | TL-FREEZE-TSC | exact singleton | true |
| TL-P-004 | all-pass fixture | scan hash 置空 | TL-FREEZE-IMPACT | exact singleton | true |
| TL-P-005 | all-pass fixture | allowed paths 少 `package.json` | TL-FREEZE-SCOPE | exact singleton | true |

## Fixed verification

```bash
cd /home/zhaoge/workspace/qoderwork/.worktrees/check-plan
git status --short
git rev-parse HEAD
codegraph status
set +e
bun run typecheck > audits/task-lens-m1/evidence/typecheck-baseline-PHASE-02.txt 2>&1
typecheck_exit=$?
set -e
printf '\nTYPECHECK_EXIT=%s\n' "$typecheck_exit" >> audits/task-lens-m1/evidence/typecheck-baseline-PHASE-02.txt
test "$typecheck_exit" -eq 1
test -s audits/task-lens-m1/evidence/typecheck-baseline-PHASE-02.txt
wc -l audits/task-lens-m1/evidence/typecheck-baseline-PHASE-02.txt
rg -n 'scripts/_b1_live\.ts\(11,44\): error TS2307' audits/task-lens-m1/evidence/typecheck-baseline-PHASE-02.txt
test -s audits/task-lens-m1/scope-lock-PHASE-02.json
wc -l audits/task-lens-m1/scope-lock-PHASE-02.json
if rg -n 'REPLACE_|"status": "PENDING"' audits/task-lens-m1/scope-lock-PHASE-02.json; then exit 1; fi
rg -n '"status": "APPROVED"|"actor_type": "HUMAN"' audits/task-lens-m1/scope-lock-PHASE-02.json
bun run .agents/skills/plan-audit-archiver/scripts/capture-state.ts \
  --repository-root /home/zhaoge/workspace/opencode/work-one \
  --scope-lock /home/zhaoge/workspace/qoderwork/.worktrees/check-plan/audits/task-lens-m1/scope-lock-PHASE-02.json \
  --phase-id PHASE-02 \
  --output /home/zhaoge/workspace/qoderwork/.worktrees/check-plan/audits/task-lens-m1/evidence/pre-change-PHASE-02.json
test -s audits/task-lens-m1/evidence/pre-change-PHASE-02.json
wc -l audits/task-lens-m1/evidence/pre-change-PHASE-02.json
rg -n '"phase_id": "PHASE-02"' audits/task-lens-m1/evidence/pre-change-PHASE-02.json
bun -e 'const x=await Bun.file("audits/task-lens-m1/evidence/pre-change-PHASE-02.json").json();if(x.phase_id!=="PHASE-02"||x.repository_realpath!=="/home/zhaoge/workspace/opencode/work-one")process.exit(1)'
```

- Required output/artifacts: scope-lock、typecheck baseline、pre-change receipt、caller scan hash。
- On non-zero/missing evidence: `BLOCKED`; preserve evidence; do not advance。

## Rollback/failure convergence

1. Human approval 前可修复 scope-lock 内容；approval 后任何改动都使旧 receipt 失效，必须新路径重新审批/捕获。
2. 禁止删除已批准 lock 或 receipt；失败件移动到 `audits/task-lens-m1/evidence/invalidated/` 需 Human reviewer 授权。

## Phase completion gate

- [x] scope-lock 无占位并精确覆盖 PHASE-02。
- [x] Human reviewer approval 已真实填写。
- [x] TL-FREEZE-SCOPE/HUMAN/HEAD/TSC/IMPACT 全 PASS。
- [x] receipt 与 typecheck baseline 非空且内容断言通过。
- [x] 未写任何生产/测试代码。
- [x] PHASE-02 在全部勾选前保持 BLOCKED。
