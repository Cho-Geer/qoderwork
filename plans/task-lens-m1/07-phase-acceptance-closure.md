# Phase PHASE-07: 十任务验收、正式审计与状态关闭 `[VERIFICATION→OBSERVATION]`

**Phase ID**: `PHASE-07`
**Depends on**: PHASE-06
**Outcome**: 10 个真实任务形成可信 feedback 数据；M1 按 metrics/test/audit 证据准确关闭或保持未解锁。
**Evidence level**: integration + manual verification

## Goal

- 实现 REQ-014；只有 10/10 feedback、≥7/10 双 yes、双目标零写、全测试、根 typecheck 与 v2.1 audit 同时 PASS 才签署 M1 gate PASS。

## Starting state and dependency

- Required status: PHASE-06 completion gate 全勾选且两 real-target receipts/manual reviews PASS。
- Required evidence: Human-approved `scope-lock-PHASE-07.json`、HEAD-bound `pre-change-PHASE-07.json`；10-task acceptance root 可读。
- If absent: `BLOCKED`, do not continue。

## Local requirements

| Requirement | Condition | Required behavior | Observable result |
|---|---|---|---|
| REQ-014-A | 真实任务计数 | 10 个 unique taskId/generated/feedback 一一对应 | missing/duplicate/invalid 均非 PASS |
| REQ-014-B | 效果阈值 | ≥7 同时 useful=yes/loadReduced=yes | summary gate PASS；<7 为 FAIL |
| REQ-014-C | 技术门 | 全 task-lens tests + root typecheck exit0 | component/integration 无失败 |
| REQ-014-D | 通用性门 | PHASE-06 两目标 current receipts 保持有效 | tracked/nonTool write NOT_FOUND |
| REQ-014-E | provenance | 每个 verification 有 EV receipt；audit validator exit0 | verdict 与 evidence ceiling 一致 |
| REQ-014-F | 文档关闭 | blueprint/index/log 四处同一状态 | 不把 FAIL/BLOCKED 写 DONE |

## Allowed files

| Exact path | Change | Exact symbol/anchor |
|---|---|---|
| `blueprints/blueprint-task-lens-m1.md` | modify | version/status/implementation evidence only |
| `documents/INDEX.md` | modify | recent update + Task Lens route |
| `logs/2026-07-23-task-lens-m1-implementation.md` | add | whole file, ≤20 lines |
| `logs/INDEX.md` | modify | date/topic entries |
| `audits/task-lens-m1/scope-lock-PHASE-07.json` | add | whole JSON |
| `audits/task-lens-m1/evidence/pre-change-PHASE-07.json` | add | whole JSON |
| `audits/task-lens-m1/2026-07-23-m1-acceptance-audit.md` | add | v2.1 audit report |
| `audits/task-lens-m1/LATEST.md` | add/modify | exact pointer/hash/verdict |

## Forbidden files and behaviors

- 禁止在本 Phase 修改 `package.json`、`scripts/task-lens/**`、`scripts/_b1_live.ts`、work-one、metrics 原始事件。
- 禁止伪造 reviewer feedback、复制同一任务为多个 taskId、删除负面 feedback、编辑 metrics 使阈值通过。
- 禁止在 BASELINE-TS-001 未由所有者清零时签署；本 Phase 不修该文件。
- 禁止 component/integration 提升为 live-E2E；M1 不需要且不得宣称 live LLM evidence。

## Fixed contract

- API/signature: `bun run task-lens metrics summarize --out /home/zhaoge/.local/state/qoderwork/task-lens/m1-acceptance --json` 是 acceptance data oracle。
- Acceptance root:
  - `/home/zhaoge/.local/state/qoderwork/task-lens/m1-acceptance/metrics.jsonl`
  - 每 task directory 必须有可解析 `card.md/task-graph.json/input-receipt.json`。
  - 每 generated/feedback taskId unique；input receipts 的 diffHash 或 targetHeadSha 至少一项与其他任务不同，证明不是复制。
- “真实任务”定义: reviewer 实际审查一次 AI 代码任务的 current change-set；非 unit fixture、非人工复制 artifact、非同一 input 重跑。
- Feedback actor: Human reviewer 运行 feedback 命令或提供逐 task 可追溯输入；agent 可执行命令但不得替 reviewer 决定 yes/no/issues/minutes。
- Gate:
  - `TL-10TASK`: generatedCount=10、feedbackCount=10、missing=[]、duplicate=[]、invalid=[]。
  - `TL-7OF10`: usefulAndReducedCount≥7。
  - 多于 10 条 unique pairs 时，冻结并使用按 generated.recordedAt 升序、taskId 升序的前 10 条；该 selection 写入 audit receipt，不删除其他事件。
- Sensitivity control: 复制 acceptance root 到新 temp out，只把一个 yes/yes feedback 改为 useful=false，使 count 从7变6；summary 必须由 PASS→FAIL，原 metrics 只读。
- Technical gate:
  - `bun test scripts/task-lens` exit0。
  - `bun run typecheck` exit0；BASELINE-TS-001 不再允许。
  - `git diff --check` exit0、`git diff --exit-code -- bun.lock` exit0。
  - PHASE-06 work-one/qoderwork receipts、human reviews 非空且 hashes 对应 current accepted implementation HEAD。
- Audit:
  - v2.1 receipt 必须绑定 `audit_id,requirement_id,polarity,oracle_id,fixture_id,command,exit_code,observed_result,artifact_hashes`。
  - positive control 用原 acceptance root；negative control 用 temp mutation root，命令字符串必须不同。
  - `validate-audit.ts` exit0 才可签署 `ACCEPT`；前序 BLOCKED 显式 CLOSED/INHERITED/REOPENED。
  - component Phase audit 若签 component ceiling，§1 必须含 P-05 四字段 downgrade declaration；最终 M1 audit evidence ceiling=`integration + manual verification`。
- Blueprint status:
  - 全 gate PASS→版本递增，M1=`IMPLEMENTED-AND-GATE-PASS`，M1.5 仅“可按数据评估”，M2 仅“解锁独立 spec”，不写已实现。
  - 技术实现 PASS 但 TL-7OF10 FAIL→`IMPLEMENTED-GATE-FAIL`；不得解锁 M2，记录是否触发 M1.5 spec。
  - evidence 缺失/UNAVAILABLE→`BLOCKED`；保持未解锁。
- Error/missing evidence behavior: 任一 task artifact、metrics line、receipt、review、validator unavailable 使 audit BLOCKED/INVALID，不得用总数0替代。
- Negative states: absence claim 仅 readable+query success+NOT_FOUND；write/evidence unavailable 必 FAIL。
- Current vs historical source: final commands和 acceptance receipts 必须在 implementation HEAD 上新执行；Phase 旧输出只作依赖证据。

## Implementation steps

```text
1. 完成 PHASE-07 scope-lock/Human approval/pre-change receipt；冻结 acceptance root 与 PHASE-06 receipts。
2. 对每个真实任务先 generate，再由 Human reviewer 审卡并提交一次 feedback；禁止批量猜测。
3. 每加入一个 feedback 后验证 metrics 最后一行可解析、taskId/hash 匹配；失败立即停止。
4. 达 10 个 unique pair 后运行 summary；保存 JSON、selected task IDs 与 artifact hashes。
5. 在复制的 temp root 执行 7→6 单 mutation sensitivity control；原 root hash 前后相同。
6. 重跑全 task-lens tests、root typecheck、bun.lock/diff checks、双目标 receipt validation。
7. 用 capture-state/EV receipts 完成 v2.1 audit；运行 validate-audit.ts。
8. 按 PASS/FAIL/BLOCKED 分支串行更新：blueprint 写后立即三联门；通过后 documents index；再通过后 implementation log；再通过后 logs index。
9. audit report 写后立即三联门并 validate；最后写 LATEST 并立即三联门。不得越级措辞。
```

## Check Registry

| Check name | Source of truth | Read/operation | PASS | Missing/corrupt behavior | Exact failure result |
|---|---|---|---|---|---|
| TL-10TASK | metrics+task dirs | full join | 10 unique complete pairs | unavailable FAIL | `["TL-10TASK"]` |
| TL-7OF10 | selected feedback | exact count | ≥7 | invalid FAIL | `["TL-7OF10"]` |
| TL-SENSITIVE | temp copy | 7→6 mutation | PASS→FAIL | source drift FAIL | `["TL-SENSITIVE"]` |
| TL-ALL-TESTS | Bun | full test | exit0 | output缺 FAIL | `["TL-ALL-TESTS"]` |
| TL-TYPECHECK | root tsc | command | exit0 | BASELINE debt FAIL | `["TL-TYPECHECK"]` |
| TL-TARGET-PURITY | PHASE-06 receipts | hash verify | two NOT_FOUND | unavailable FAIL | `["TL-TARGET-PURITY"]` |
| TL-AUDIT | audit/receipts | validate-audit | valid=true/errors0 | missing INVALID | `["TL-AUDIT"]` |
| TL-DOC-STATE | four docs | exact status compare | all equal | missing/drift FAIL | `["TL-DOC-STATE"]` |

## All-pass Fixture

| Evidence object | Creation method | Required fields/data | Why required |
|---|---|---|---|
| acceptance root | 10 real generate/feedback cycles | 10 unique pairs/artifacts | product value |
| selected-task receipt | deterministic selection | IDs/input hashes/artifact hashes | no duplicate inflation |
| negative temp root | copy then one field mutation | original hash + changed line | sensitivity |
| technical outputs | fresh commands | tests/typecheck/diff/bun.lock | implementation |
| PHASE-06 bundle | retained evidence | two targets/reviews/snapshots | generality |
| EV receipts/audit | capture/validator tools | v2.1 fields/verdict | provenance |

## Single-failure Matrix

| Test ID | Baseline | Only mutation | Expected check | Exact failedChecks/error | Other checks |
|---|---|---|---|---|---|
| TL-M-601 | 10 pairs | remove one feedback in copy | TL-10TASK | singleton/INCOMPLETE | true |
| TL-M-602 | 7 yes/yes | set one useful=false | TL-7OF10 | singleton/FAIL | true |
| TL-M-603 | valid task dir | corrupt graph JSON in copy | TL-10TASK | singleton/UNAVAILABLE | true |
| TL-M-604 | target receipt | change one after hash | TL-TARGET-PURITY | singleton/FOUND | true |
| TL-M-605 | valid audit copy | remove one EV receipt | TL-AUDIT | singleton/INVALID | true |
| TL-M-606 | consistent docs copy | change blueprint status | TL-DOC-STATE | singleton | true |

## Fixed verification

```bash
cd /home/zhaoge/workspace/qoderwork/.worktrees/check-plan
test -s audits/task-lens-m1/evidence/pre-change-PHASE-07.json
bun run task-lens metrics summarize --out /home/zhaoge/.local/state/qoderwork/task-lens/m1-acceptance --json
bun test scripts/task-lens
bun run typecheck
git diff --check
git diff --exit-code -- bun.lock
test -s audits/task-lens-m1/2026-07-23-m1-acceptance-audit.md
wc -l audits/task-lens-m1/2026-07-23-m1-acceptance-audit.md
rg -n '^# |\\*\\*Verdict\\*\\*:' audits/task-lens-m1/2026-07-23-m1-acceptance-audit.md
bun run .agents/skills/plan-audit-archiver/scripts/validate-audit.ts audits/task-lens-m1/2026-07-23-m1-acceptance-audit.md
test -s blueprints/blueprint-task-lens-m1.md
wc -l blueprints/blueprint-task-lens-m1.md
rg -n 'IMPLEMENTED-AND-GATE-PASS|IMPLEMENTED-GATE-FAIL|BLOCKED' blueprints/blueprint-task-lens-m1.md
test -s documents/INDEX.md
wc -l documents/INDEX.md
rg -n 'plans/task-lens-m1/00-plan-index\\.md' documents/INDEX.md
test -s logs/2026-07-23-task-lens-m1-implementation.md
wc -l logs/2026-07-23-task-lens-m1-implementation.md
test "$(wc -l < logs/2026-07-23-task-lens-m1-implementation.md)" -le 20
rg -n '^# 2026-07-23' logs/2026-07-23-task-lens-m1-implementation.md
test -s logs/INDEX.md
wc -l logs/INDEX.md
rg -n '2026-07-23-task-lens-m1-implementation\\.md' logs/INDEX.md
test -s audits/task-lens-m1/LATEST.md
wc -l audits/task-lens-m1/LATEST.md
rg -n '2026-07-23-m1-acceptance-audit\\.md' audits/task-lens-m1/LATEST.md
```

- Required output/artifacts: 10-task summary、sensitivity receipts、full tests/typecheck、two target bundles、valid audit、four synced docs。
- Expected evidence level: integration + manual verification；live-LLM-E2E=`NOT-RUN`/not required。
- On non-zero/missing evidence: `BLOCKED`; preserve evidence; do not sign ACCEPT。

## Rollback/failure convergence

1. acceptance FAIL 不回滚实现或篡改 feedback；按状态分支保留原 metrics/receipts。
2. 文档同步失败只恢复本 Phase 4 个文档到前一完整版本；审计/evidence 不删除。

## Phase completion gate

- [ ] PHASE-07 Freeze Gate 与 10-task selection receipt 完整。
- [ ] TL-10TASK、TL-7OF10、TL-SENSITIVE 全 PASS。
- [ ] full tests、root typecheck、bun.lock/diff、双目标 purity 全 PASS。
- [ ] v2.1 audit receipts 齐全且 validate-audit exit0。
- [ ] blueprint/documents/log/log index 状态完全一致且逐文件完整性验证。
- [ ] M1.5/M2 仅按 gate 规则描述，M2/M3 未被写成已实现。
- [ ] 任一未勾选则 M1 不得关闭。
