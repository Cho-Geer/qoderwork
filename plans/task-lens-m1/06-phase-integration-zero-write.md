# Phase PHASE-06: Fixture Integration 与双目标零写入 `[ANALYSIS→VERIFICATION]`

**Phase ID**: `PHASE-06`
**Depends on**: PHASE-05
**Outcome**: 完整 CLI 在 fixture、work-one、qoderwork-main 三类当前输入上产出可核验 artifact，两个真实目标无内容写入。
**Evidence level**: integration
**Progression status**: `BLOCKED`

## Goal

- 实现 REQ-013；用真实进程、真实 Git、真实 CodeGraph SQLite 和外部 out 证明 M1 管线，而不是重测内部函数。

## Starting state and dependency

- Required status: PHASE-05 completion gate 全勾选。
- Required evidence: Human-approved `scope-lock-PHASE-06.json`、HEAD-bound `pre-change-PHASE-06.json`；work-one 与 qoderwork-main `codegraph status` 均 up-to-date。
- If absent: `BLOCKED`, do not continue。

## Local requirements

| Requirement | Condition | Required behavior | Observable result |
|---|---|---|---|
| REQ-013-A | fixture working-tree | tracked+untracked 生成；pure delete degraded | 三 artifact/metrics 与 exit 0/2 一致 |
| REQ-013-B | fixture commit | clean base..HEAD 稳定；dirty 拒绝 | 两次 TaskGraph canonical hash 相等 |
| REQ-013-C | coverage/provider | DB path/FN/DA/unaligned/fallback 组合 | receipt/provider/observation 三态正确 |
| REQ-013-D | safety | project out/symlink/existing artifact/双 provider fail | exact exit 10/12/21 |
| REQ-013-E | work-one | 当前 change-set 出卡 | 五节、low confidence、unverified 可人工读 |
| REQ-013-F | qoderwork-main | 当前 change-set 出卡 | 第二已索引 TS 项目成功 |
| REQ-013-G | target purity | 运行前后 status/tree hash 相等 | 两真实目标 `NOT_FOUND` writes |

## Allowed files

| Exact path | Change | Exact symbol/anchor |
|---|---|---|
| `scripts/task-lens/__tests__/integration.test.ts` | add | fixture + real-target integration suites |
| `scripts/task-lens/README.md` | modify | integration/dogfood evidence procedure |

## Forbidden files and behaviors

- 禁止为 integration 失败修改生产文件；失败必须回到 owning Phase 的新 rework scope-lock。
- 禁止执行 `codegraph sync/index/init`、创建目标项目文件、使用目标项目内 out、裸服务、LLM、固定 `/tmp`。
- 禁止跳过真实目标 suite、把 test skip 当 PASS、忽略 before/after hash/status 差异。
- 禁止清理失败 run 的外部 evidence；禁止修改 work-one/qoderwork-main dirty state。

## Fixed contract

- API/signature: test-local `hashTargetTree(project:string): Promise&lt;TargetSnapshot&gt;`；`runRealTarget(case:RealTargetCase): Promise&lt;RealTargetReceipt&gt;`。
- Real targets:
  - `WORK_ONE=/home/zhaoge/workspace/opencode/work-one`
  - `QODERWORK_MAIN=/home/zhaoge/workspace/qoderwork`
  - 当前实施 repo=`/home/zhaoge/workspace/qoderwork/.worktrees/check-plan`，不计为第二目标。
- Mode selection is deterministic:
  1. `git status --porcelain=v1 -z --untracked-files=all` 非空→`working-tree`。
  2. 输出为空→`commit`，base=`git rev-parse HEAD^`；无 parent→`BLOCKED`。
  3. 两分支都要求当前 HEAD 的 CodeGraph DB provider capability PASS；不允许 CLI fallback 作为真实目标成功证据。
- TargetSnapshot:
  - `{realpath,head,statusSha256,trackedContentSha256,nonToolTreeSha256,fileCount}`。
  - status hash 来自完整 porcelain `-z` bytes；tracked hash 按 `git ls-files -z` 文件 path+content hash 排序。
  - nonTool tree 遍历项目全部 regular files/symlinks，排除 `.git/**`、`.codegraph/**`，记录 relative path/type/target-or-content hash；任何 unreadable=`UNAVAILABLE`。
- RealTargetReceipt:
  - `{target,before,after,mode,baseSha,headSha,outRealpath,taskId,exitCode,artifactHashes,metricsLine,writeState:"NOT_FOUND"}`。
  - before/after 的 head、status、trackedContent、nonToolTree、fileCount 必须全相等；否则 writeState=`FOUND`、suite FAIL、保留 out。
- Evidence out:
  - root=`/home/zhaoge/.local/state/qoderwork/task-lens/m1-validation/PHASE-06`
  - 每次 test 的 run id 依次连接 `targetName,headSha,ISO-basic,randomUUID`；test 打印 exact path。
  - out 必须 realpath 严格不在任一 target 内；失败 evidence 不删除。
- Fixture integration:
  - test 用 temp Git repo 与最小真实 CodeGraph SQLite schema；fixture 内 `.codegraph` 是测试输入，允许创建。
  - working-tree all-pass 包含 staged、unstaged、untracked、rename、function add；delete-only 单独 run exit2。
  - commit all-pass 有 base/head 两 commit、clean tree；重复运行使用不同 out 但 TaskGraph canonical hash（排除 receipt generatedAt/out path）相等。
  - provider fallback 的 CLI 输出使用 fixture executable/runner，标 FAKE-INJECTION；真实目标必须 DB provider。
- Current observation:
  - 每个 real run 重新读取 DB schema/project metadata 与 Git state。
  - 运行前 `codegraph status` 仅作 precondition，完成后才捕获 before snapshot；task-lens 本身不得调用 fallback。
- Manual card oracle: 五标题 exact；每个 seed 有函数/DeletedRegion；static-low、unknown、uncovered/truncation 只在事实存在时出现；reviewer 记录 `PASS/FAIL`，不得据模板自签。
- Error/missing evidence behavior: target snapshot/read/query/out artifact 任一不可用=`UNAVAILABLE`，整个 real target FAIL；不能只看 Git status。
- Negative states: write PASS 仅 before/after 两组 hash 全等且 query succeeded；缺 hash/权限/异常均不是 `NOT_FOUND`。
- Current vs historical source: PHASE-06 run receipt；blueprint 的 work-one 示例仅形态说明。

## Implementation steps

```text
1. 完成 PHASE-06 Freeze Gate；caller_tests 必须列出此前 8 个 task-lens test files。
2. integration.test.ts 先实现 fixture repo/DB/coverage/out factory；所有对象由 test 创建并登记。
3. 写 fixture working-tree、commit、pure-delete、coverage、provider fallback、安全负例；禁止依赖用户仓库。
4. 实现 target snapshot；在一个故意写入 fixture 的敏感反例中证明 TL-ZERO-WRITE 会 FAIL。
5. 实现两个 real target cases；status 非空走 working-tree，空走 commit HEAD^。
6. 在启动 task-lens 前捕获 before；完成并 read-back artifacts/metrics 后捕获 after，再比较。
7. Human reviewer 人工读两张 card 并在 external evidence 写 review receipt；agent 不代签。
8. README 写 exact 命令、evidence root、mode selection、失败保留规则。
9. 运行 Fixed verification；任何 skip、target hash drift、UNAVAILABLE、额外诊断立即停止。
```

## Check Registry

| Check name | Source of truth | Read/operation | PASS | Missing/corrupt behavior | Exact failure result |
|---|---|---|---|---|---|
| TL-INT-WT | fixture artifacts | full CLI readback | tracked+untracked complete | object缺 FAIL | `["TL-INT-WT"]` |
| TL-INT-COMMIT | two fixture runs | canonical hash compare | exact equal | dirty/hash缺 FAIL | `["TL-INT-COMMIT"]` |
| TL-INT-DELETED | delete-only run | graph/card/exit | DeletedRegion+exit2 | live seed伪造 FAIL | `["TL-INT-DELETED"]` |
| TL-INT-COVERAGE | aligned/unaligned runs | observations/receipt | exact three-state | proof缺 degraded | `["TL-INT-COVERAGE"]` |
| TL-INT-SAFETY | negative runs | exits/no final | 10/12/21 exact | evidence缺 FAIL | `["TL-INT-SAFETY"]` |
| TL-WORK-ONE | real receipt | artifact/card/metrics | valid current run | unavailable FAIL | `["TL-WORK-ONE"]` |
| TL-QODERWORK | real receipt | artifact/card/metrics | valid current run | unavailable FAIL | `["TL-QODERWORK"]` |
| TL-ZERO-WRITE | snapshots | all hash compares | writeState NOT_FOUND | compare unavailable FAIL | `["TL-ZERO-WRITE"]` |
| TL-MANUAL-CARD | human receipt | five-section review | both PASS | missing BLOCKED | `["TL-MANUAL-CARD"]` |
| TL-TSC-DELTA | tsc | baseline diff | zero new diagnostics | baseline缺 FAIL | `["TL-TSC-DELTA"]` |

## All-pass Fixture

| Evidence object | Creation method | Required fields/data | Why required |
|---|---|---|---|
| working-tree repo | temp Git + SQLite DB | all diff classes/functions | full generate |
| commit repo | two commits/clean | deterministic base/head | repeatability |
| lcov pair | aligned FN/DA + unaligned | companion hashes | coverage |
| external evidence root | state path | unique run dirs | retention |
| two target snapshots | real read-only traversal | before/after all fields | zero-write |
| manual reviews | Human reviewer | target/taskId/card hash/verdict | readability |

## Single-failure Matrix

| Test ID | Baseline | Only mutation | Expected check | Exact failedChecks/error | Other checks |
|---|---|---|---|---|---|
| TL-I-501 | WT fixture | remove untracked node | TL-INT-WT | singleton | true |
| TL-I-502 | clean commit | add dirty file | TL-INT-COMMIT | exit10 | true |
| TL-I-503 | delete-only | inject fake live seed | TL-INT-DELETED | singleton | true |
| TL-I-504 | aligned lcov | change companion head | TL-INT-COVERAGE | exit2/unknown | true |
| TL-I-505 | external out | symlink into project | TL-INT-SAFETY | exit10/no final | true |
| TL-I-506 | valid target | write one sentinel file in fixture | TL-ZERO-WRITE | FOUND | true |
| TL-I-507 | valid snapshot | make one file unreadable | TL-ZERO-WRITE | UNAVAILABLE | true |
| TL-I-508 | real receipt | remove card heading in copy | TL-MANUAL-CARD | human FAIL | true |

## Fixed verification

```bash
cd /home/zhaoge/workspace/qoderwork/.worktrees/check-plan
test -s audits/task-lens-m1/evidence/pre-change-PHASE-06.json
bun test scripts/task-lens
TASK_LENS_REAL_TARGETS=1 bun test scripts/task-lens/__tests__/integration.test.ts
set +e
bun run typecheck > audits/task-lens-m1/evidence/typecheck-after-PHASE-06.txt 2>&1
typecheck_exit=$?
set -e
printf '\nTYPECHECK_EXIT=%s\n' "$typecheck_exit" >> audits/task-lens-m1/evidence/typecheck-after-PHASE-06.txt
test "$typecheck_exit" -eq 1
diff -u audits/task-lens-m1/evidence/typecheck-baseline-PHASE-02.txt audits/task-lens-m1/evidence/typecheck-after-PHASE-06.txt
git diff --check
git diff --exit-code -- bun.lock
test -d /home/zhaoge/.local/state/qoderwork/task-lens/m1-validation/PHASE-06
rg -n '"writeState":"NOT_FOUND"|"writeState": "NOT_FOUND"' /home/zhaoge/.local/state/qoderwork/task-lens/m1-validation/PHASE-06
```

- Required output/artifacts: full suite PASS、real-target 2 receipts、before/after snapshots、cards/graphs/input receipts/metrics、2 human reviews。
- Expected evidence level: integration + manual review；不构成 10-task M1 gate。
- On non-zero/missing evidence: `BLOCKED`; preserve evidence; do not advance。

## Rollback/failure convergence

1. 本 Phase 失败不改生产代码；创建 rework finding 并回到 owning Phase，精确列 allowed files。
2. 禁止删除 real-target evidence 或修改目标项目恢复 hash；若 writeState FOUND，保留现场并停止。

## Phase completion gate

- [ ] PHASE-06 Freeze Gate 与全部 caller tests 完整。
- [ ] fixture WT/commit/delete/coverage/safety checks 全 PASS。
- [ ] work-one 与 qoderwork-main 两份 current run receipt 完整。
- [ ] TL-ZERO-WRITE 敏感反例先 FAIL，真实两目标后 PASS。
- [ ] 两份 Human manual card review PASS。
- [ ] typecheck 零新增、bun.lock 无 diff、Allowed-file diff only。
- [ ] PHASE-07 在全部勾选前保持 BLOCKED。
