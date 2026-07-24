# Phase PHASE-05: Metrics 并发、Feedback 与完整 CLI `[ANALYSIS→VERIFICATION]`

**Phase ID**: `PHASE-05`
**Depends on**: PHASE-04
**Outcome**: generate/feedback/metrics summarize 全链可用；metrics 在并发与崩溃窗口下不重复、不丢失且可恢复。
**Evidence level**: integration
**Progression status**: `NOT_STARTED`

## Goal

- 实现 REQ-011/012；generated 仅在三件 artifact 完整提交后出现，feedback 一任务一次，summary 能给出 10-task 硬门三态。

## Starting state and dependency

- Required status: PHASE-04 completion gate 全勾选。
- Required evidence: Human-approved `scope-lock-PHASE-05.json`、HEAD-bound `pre-change-PHASE-05.json`；caller_tests 覆盖 artifact writer 与 CLI callers。
- If absent: `BLOCKED`, do not continue。

## Local requirements

| Requirement | Condition | Required behavior | Observable result |
|---|---|---|---|
| REQ-011-A | generate 成功 | artifact commit 后 lock+append+fsync generated | 一行合法 JSON、taskId 唯一 |
| REQ-011-B | metrics append 中断 | 同 taskId retry 只补缺失 event，不覆盖 artifact | query FOUND 拒绝；NOT_FOUND 可恢复；UNAVAILABLE 失败 |
| REQ-011-C | feedback | 校验 task/generated、字段和值域、拒绝重复 | 一任务最多一条 feedback |
| REQ-011-D | concurrent writers | 目录 lock 串行化，5s 未获锁失败 | 行不交错、逐行 JSON.parse |
| REQ-011-E | summarize | 只读 metrics 并按 taskId join | INCOMPLETE/PASS/FAIL 三态与计数 |
| REQ-012-A | 负例/诊断 | all-pass 后单 mutation | exact singleton failedChecks |
| REQ-012-B | CLI wiring | generate 调完整确定性管线 | fixed exit code 与 artifacts/metrics 一致 |

## Allowed files

| Exact path | Change | Exact symbol/anchor |
|---|---|---|
| `scripts/task-lens/metrics.ts` | add | `appendGenerated`, `appendFeedback`, `summarizeMetrics` |
| `scripts/task-lens/cli.ts` | modify | `main` full pipeline/subcommands |
| `scripts/task-lens/artifact-writer.ts` | modify | verified generated-event recovery |
| `scripts/task-lens/README.md` | add | CLI/config/artifact/exit contract |
| `scripts/task-lens/__tests__/metrics.test.ts` | add | validation/lock/recovery/summary |
| `scripts/task-lens/__tests__/cli-integration.test.ts` | add | end-to-end fixture CLI |

## Forbidden files and behaviors

- 禁止修改 types/provider/graph/coverage/renderer 行为来迎合测试，禁止 `bun.lock`/work-one 写入。
- 禁止无锁 append、truncate 既有 metrics、自动删除 stale lock、重复 feedback、把损坏 JSONL 当空文件。
- 禁止覆盖 task artifact；recovery 只允许在 artifact hashes 全匹配且 generated=`NOT_FOUND` 时 append。
- 禁止 summary 把 evidence `UNAVAILABLE` 当 0 或把不足 10 个任务判 PASS。

## Fixed contract

- API/signature:
  - `appendGenerated(out:string,event:GeneratedEvent): Promise&lt;void&gt;`
  - `appendFeedback(out:string,event:FeedbackEvent): Promise&lt;void&gt;`
  - `summarizeMetrics(out:string): Promise&lt;MetricsSummary&gt;`
  - `withMetricsLock&lt;T&gt;(out:string,operation:()=>Promise&lt;T&gt;): Promise&lt;T&gt;`
- GeneratedEvent:
  - `{schemaVersion:"task-lens.metrics/v1",event:"generated",taskId,recordedAt,seedCount,edgeCount,displayNodeCount,coverage:{observed,notObserved,unknown},truncation:string[],exitCode:0|2,artifactHashes:{card,graph,receipt}}`
  - recordedAt=`input-receipt.generatedAt`；数组稳定排序；整数非负；displayNodeCount≤20。
- FeedbackEvent:
  - `{schemaVersion:"task-lens.metrics/v1",event:"feedback",taskId,recordedAt,useful:boolean,loadReduced:boolean,issuesFound:number,issuesGuidedByCard:number,reviewMinutes:number,notes:string}`
  - integers `issuesFound/issuesGuidedByCard` ≥0 且 guided≤found；reviewMinutes>0 且 finite；notes UTF-8 ≤2000 code points。
- MetricsSummary:
  - `{schemaVersion:"task-lens.summary/v1",generatedCount,feedbackCount,usefulAndReducedCount,missingFeedbackTaskIds,duplicateTaskIds,invalidLineNumbers,gate:"INCOMPLETE"|"PASS"|"FAIL"}`
  - invalid/corrupt/duplicate line 使 evidence `UNAVAILABLE`、命令 non-zero，不输出可签署 gate。
  - generated<10 或 feedback<10 或 missing 非空=`INCOMPLETE`；恰有≥10 unique paired tasks 且 usefulAndReducedCount≥7=`PASS`；paired≥10 但小于7=`FAIL`。
- Lock:
  - lock dir=`out + "/.task-lens-metrics.lock"`，`mkdir` 原子获取；写 `owner.json={pid,createdAt,taskId,event}` 后 fsync。
  - 50ms interval、总 5000ms；超时 exit21。禁止 PID 猜测、stale lock 自动删除；仅 owner 正常 finally 删除自己创建的 lock dir。
  - metrics path=`out + "/metrics.jsonl"`；在 lock 内先完整 parse 现有文件，再 `open("a")` 写 `JSON.stringify(event)+"\n"`，fsync file+out dir。
- Generated recovery:
  1. final task dir `FOUND` 时只读三 artifact，验证 schema/taskId/hash/card headings。
  2. metrics query 必须 readable+parse+success。
  3. generated `FOUND`→exit21 conflict；`UNAVAILABLE`→exit21；`NOT_FOUND`→从 artifacts 重建 exact GeneratedEvent 并 append。
  4. 不修改/重写 final artifact；feedback 不可由 recovery 生成。
- Feedback: task dir 与 generated 必须 FOUND；feedback NOT_FOUND 才 append；缺 task/generated 或 duplicate 为 exit10，metrics unavailable 为 exit21。
- CLI:
  - `bun run task-lens [generate] --project ABS --mode working-tree|commit --out ABS [--base SHA] [--config FILE] [--coverage LCOV] [--entry FILE#NAME]`
  - `bun run task-lens feedback --out ABS --task-id ID --useful yes|no --load-reduced yes|no --issues-found N --issues-guided-by-card N --review-minutes N [--notes TEXT]`
  - `bun run task-lens metrics summarize --out ABS [--json]`
- Exit precedence 保持 `21>20>12>10>13>2>1`；generate success 0，degraded 2；summary INCOMPLETE=2、FAIL=1、PASS=0、UNAVAILABLE=21。
- Error/missing evidence behavior: artifact complete但metrics append失败→exit21；retry 走 recovery。artifact incomplete 绝不 recovery。
- Negative states: generated/feedback lookup 分 `FOUND/NOT_FOUND/UNAVAILABLE`；只有成功 parse+完整扫描才能 NOT_FOUND。
- Current vs historical source: summary 每次重新读取当前 metrics；历史 summary 不能关闭 10-task gate。

## Implementation steps

```text
1. 完成 PHASE-05 Freeze Gate；scope-lock caller_tests 至少列 artifact-writer.test.ts 与前序 CLI tests。
2. 实现严格 JSONL scanner，返回 readable/querySucceeded/FOUND|NOT_FOUND|UNAVAILABLE 与 line diagnostics。
3. 实现 mkdir lock、owner、timeout、append+fsync；finally 只删除本进程成功创建的 lock。
4. 实现 generated/feedback schema validation、唯一性与 summary 三态。
5. 修改 artifact writer/CLI：正常生成 commit artifact 后 append；同 taskId 只走 verified recovery。
6. README 固定所有 CLI、config、artifact、event、exit code；不写未来 M2/M3 为现有能力。
7. metrics.test.ts 用两个独立 Bun subprocess 竞争 lock；cli-integration 用真实临时 Git repo 执行 generate→feedback→summary。
8. fake fault hook 标 FAKE-INJECTION；至少一个多进程测试使用真实 filesystem/append/fsync。
9. 运行 Fixed verification；任何重复/坏行/partial artifact/新增诊断立即停止。
```

## Check Registry

| Check name | Source of truth | Read/operation | PASS | Missing/corrupt behavior | Exact failure result |
|---|---|---|---|---|---|
| TL-LOCK | lock dir | two-process attempt | serial+owner cleanup | stale/timeout FAIL | `["TL-LOCK"]` |
| TL-JSONL | metrics file | full line parse | every line valid | bad/truncated UNAVAILABLE | `["TL-JSONL"]` |
| TL-GENERATED | artifacts+metrics | hash/join | one exact event | missing append FAIL | `["TL-GENERATED"]` |
| TL-RECOVERY | existing task | three-state lookup | only NOT_FOUND repairs | FOUND/UNAVAILABLE reject | `["TL-RECOVERY"]` |
| TL-FEEDBACK | task+event | validate/join | one valid feedback | missing/duplicate FAIL | `["TL-FEEDBACK"]` |
| TL-SUMMARY | JSONL | aggregate | exact counts/gate | invalid UNAVAILABLE | `["TL-SUMMARY"]` |
| TL-CLI-FLOW | subprocess | generate→feedback→summary | exits/artifacts一致 | missing FAIL | `["TL-CLI-FLOW"]` |
| TL-NEGATIVE | test registry | singleton assertions | exact one failure | coupled FAIL | `["TL-NEGATIVE"]` |
| TL-TSC-DELTA | tsc | baseline diff | zero new diagnostics | baseline缺 FAIL | `["TL-TSC-DELTA"]` |

## All-pass Fixture

| Evidence object | Creation method | Required fields/data | Why required |
|---|---|---|---|
| complete task dir | real PHASE-04 writer | exact three files/hashes | generated/recovery |
| metrics.jsonl | real append | one generated+one feedback | scanner/join |
| concurrent out | fresh temp dir | two distinct taskIds | lock |
| ten-task metrics | table-driven valid events | 10 pairs、7 yes/yes | PASS summary |
| CLI Git repo | temp initialized repo | indexed provider fake boundary、external out | orchestration |

## Single-failure Matrix

| Test ID | Baseline | Only mutation | Expected check | Exact failedChecks/error | Other checks |
|---|---|---|---|---|---|
| TL-C-401 | valid pair | truncate last JSON line | TL-JSONL | singleton/UNAVAILABLE | true |
| TL-C-402 | free lock | precreate lock dir | TL-LOCK | singleton/exit21 | true |
| TL-C-403 | complete task, no event | alter artifact hash | TL-RECOVERY | singleton/exit21 | true |
| TL-C-404 | valid feedback | guided=found+1 | TL-FEEDBACK | singleton/exit10 | true |
| TL-C-405 | one feedback | append duplicate taskId | TL-FEEDBACK | singleton/exit10 | true |
| TL-C-406 | 10 pairs/7 yes | change one useful to no | TL-SUMMARY | gate FAIL | true |
| TL-C-407 | generated flow | inject append EACCES | TL-GENERATED | exit21/artifact retained | true |
| TL-C-408 | valid CLI | remove generated before feedback | TL-CLI-FLOW | exit10 | true |

## Fixed verification

```bash
cd /home/zhaoge/workspace/qoderwork/.worktrees/check-plan
test -s audits/task-lens-m1/evidence/pre-change-PHASE-05.json
bun test scripts/task-lens/__tests__/metrics.test.ts scripts/task-lens/__tests__/cli-integration.test.ts
set +e
bun run typecheck > audits/task-lens-m1/evidence/typecheck-after-PHASE-05.txt 2>&1
typecheck_exit=$?
set -e
printf '\nTYPECHECK_EXIT=%s\n' "$typecheck_exit" >> audits/task-lens-m1/evidence/typecheck-after-PHASE-05.txt
test "$typecheck_exit" -eq 1
diff -u audits/task-lens-m1/evidence/typecheck-baseline-PHASE-02.txt audits/task-lens-m1/evidence/typecheck-after-PHASE-05.txt
git diff --check
git diff --exit-code -- bun.lock
rg -n 'appendFile|fsync|\\.task-lens-metrics\\.lock|FOUND|NOT_FOUND|UNAVAILABLE' scripts/task-lens/metrics.ts scripts/task-lens/artifact-writer.ts
rg -n 'FAKE-INJECTION' scripts/task-lens/__tests__/metrics.test.ts scripts/task-lens/__tests__/cli-integration.test.ts
```

- Required output/artifacts: 2 suites PASS、真实 multi-process lock evidence、valid/corrupt JSONL、recovery/summary outputs、typecheck delta。
- Expected evidence level: integration（仅本地进程/fixture）；不等于两个真实目标项目验收。
- On non-zero/missing evidence: `BLOCKED`; preserve evidence; do not advance。

## Rollback/failure convergence

1. 仅撤销 6 个 Allowed files；保留 metrics/artifact failure fixture。
2. 锁残留时标 BLOCKED 并报告 owner；禁止 agent 自动删锁或 truncate metrics。

## Phase completion gate

- [ ] PHASE-05 Freeze Gate 与 caller tests 完整。
- [ ] lock/JSONL/generated/recovery/feedback/summary/CLI checks 全 PASS。
- [ ] 两独立进程真实竞争；坏 JSONL 与 duplicate 均 fail-closed。
- [ ] 每个 check 有 all-pass+single mutation，failedChecks 精确 singleton。
- [ ] typecheck 零新增、bun.lock 无 diff、Allowed-file diff only。
- [ ] PHASE-06 在全部勾选前保持 BLOCKED。
