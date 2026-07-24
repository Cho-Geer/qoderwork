# Phase PHASE-04: Coverage 三态、五节卡与原子 Artifact `[ANALYSIS→VERIFICATION]`

**Phase ID**: `PHASE-04`
**Depends on**: PHASE-03
**Outcome**: TaskGraph 获得可信 observation/sideEffects，并一次性写出单一 card、graph、receipt；尚不写 metrics。
**Evidence level**: component
**Progression status**: `BLOCKED`

## Goal

- 实现 REQ-008/009/010；coverage 不能证明对齐时仍出 degraded 卡，但任何 artifact 完整性失败必须零提交。

## Starting state and dependency

- Required status: PHASE-03 completion gate 全勾选。
- Required evidence: Human-approved `scope-lock-PHASE-04.json` 与 HEAD-bound `pre-change-PHASE-04.json`；impact caller tests 覆盖 PHASE-03 共享类型/函数。
- If absent: `BLOCKED`, do not continue。

## Local requirements

| Requirement | Condition | Required behavior | Observable result |
|---|---|---|---|
| REQ-008-A | lcov 有可信 FN/FNDA | file+name+declaration line 唯一匹配 | count>0 observed；=0 not-observed |
| REQ-008-B | 无 FN/FNDA | DA 与 inclusive function range 求交 | >0 observed；全0 not-observed；无DA unknown |
| REQ-008-C | coverage 缺失/坏/未绑定 | observation 全 unknown | 卡生成且 exit 2，原因入 unverified |
| REQ-009-A | side effects | 仅内建/config literal token | DB/FS/NET/PROC 明细标“启发式” |
| REQ-009-B | renderer | 单一 TaskGraph→固定五节 card | 声明/观测、low confidence、uncovered 可见 |
| REQ-010-A | serialization | stable arrays、plain JSON、禁 Map | 同 TaskGraph 核心 JSON hash 稳定 |
| REQ-010-B | artifact commit | staging+fsync+atomic rename+拒绝覆盖 | 三文件全有或全无；失败 exit 21 |

## Allowed files

| Exact path | Change | Exact symbol/anchor |
|---|---|---|
| `scripts/task-lens/coverage-reader.ts` | add | `readCoverage` |
| `scripts/task-lens/side-effects.ts` | add | `detectSideEffects` |
| `scripts/task-lens/card-renderer.ts` | add | `renderCard` |
| `scripts/task-lens/artifact-writer.ts` | add | `writeArtifacts` |
| `scripts/task-lens/__tests__/coverage-render.test.ts` | add | lcov/effect/card suites |
| `scripts/task-lens/__tests__/artifact-writer.test.ts` | add | canonical/atomic/conflict suites |

## Forbidden files and behaviors

- 禁止修改 upstream graph/diff/provider、package、work-one、`bun.lock`。
- 禁止把 lcov mtime、文件存在或成功 parse 单独当作 change-set 对齐证明。
- 禁止 `JSON.stringify(Map)`、直接写 final 文件、覆盖既有 taskId、先写 card 后补 JSON。
- 本 Phase 禁止 metrics、feedback、多卡、LLM；artifact 失败后禁止 metrics side effect。

## Fixed contract

- API/signature:
  - `readCoverage(path:string|undefined, binding:CoverageBinding, nodes:FunctionNode[]): Promise&lt;CoverageResult&gt;`
  - `detectSideEffects(source:string, config:TaskLensConfigV1): SideEffect[]`
  - `renderCard(graph:TaskGraphV1, receipt:TaskInputReceipt): string`
  - `writeArtifacts(request:ArtifactWriteRequest): Promise&lt;ArtifactReceipt&gt;`
- `Observation="observed"|"not-observed"|"unknown"`；仅 coverage reader 可赋值。
- CoverageBinding:
  - `{producer:string|null,fileSha256:string,mtimeMs:number,targetHeadSha:string,diffHash:string,proofState:"ALIGNED"|"UNVERIFIED"}`
  - 可选 companion `coveragePath + ".task-lens.json"` 必须为 `{schemaVersion:"task-lens.coverage/v1",producer,targetHeadSha,diffHash,lcovSha256}`；hash/head/diff 全等才 ALIGNED。
  - companion 缺失/坏/字段不等为 UNVERIFIED，不阻止卡，但所有 nodes unknown、unverified 加 `COVERAGE_UNALIGNED`、exit 2。
- lcov parser:
  - record 以 `SF`/`end_of_record` 切分；relative SF 以 projectRealpath 解析，越界 target 文件忽略并记录。
  - FN=`line,name`；FNDA=`count,name`；仅 normalized file+name+line 唯一时使用，重复/缺 count unknown。
  - 没有任何 FN/FNDA 才用 DA；inclusive `[startLine,endLine]` 中任一 count>0 observed；存在 DA 且全0 not-observed；无 DA unknown。
- SideEffect:
  - `{kind:"DB"|"FS"|"NET"|"PROC",token:string,source:"builtin"|"config",heuristic:true}`，按 kind/token/source 排序去重。
  - builtin literals: DB=`bun:sqlite`；FS=`node:fs`,`Bun.file(`,`Bun.write(`；NET=`fetch(`,`Bun.serve(`；PROC=`Bun.spawn(`,`Bun.spawnSync(`,`node:child_process`,`process.env`。
  - config 只追加 literal token，不替换 builtins；仅在 FunctionNode source range 文本搜索。
- TaskGraphV1 使用 blueprint 字段，nodes/edges/seeds/deletedRegions/branches/uncovered/truncation/unverified 在序列化前稳定排序；deep walker 遇 `Map/Set/function/symbol/undefined` 立即 exit 21。
- card.md 固定标题和五个二级标题；每个 function row 显示 location/signature/heuristic side effect/observation；confidence<0.8 标 `static-low`；unknown/uncovered/truncation 全列。
- Atomic write:
  1. final=`OUT/taskId`，存在即 exit21。
  2. staging=`OUT/.taskId.UUID.tmp`，mode 0700；用 `wx` 写三文件。
  3. 每文件 `fsync`，read-back parse/hash；card 非空且五标题。
  4. fsync staging dir，`rename(staging,final)`，fsync OUT dir。
  5. rename/验证失败清理仅本 staging；final 若出现不完整则 FAIL 并保留，不得覆盖。
- `ArtifactReceipt={schemaVersion:"task-lens.artifact/v1",taskId,files:{path,sha256,bytes}[]}`；generatedAt 只在 input receipt。
- Exit: only-delete/no seed、coverage unverified、graph truncation=2；artifact=21；多原因取优先级 `21>20>12>10>13>2>1`。
- Error/missing evidence behavior: coverage 是可降级输入；TaskGraph/receipt/card 任一缺失或 parse/hash 错误是 fatal 21。
- Negative states: final dir query 成功且不存在才 `NOT_FOUND`；out 不可读/rename 状态未知为 `UNAVAILABLE`/21。
- Current vs historical source: coverage companion 绑定当前 receipt head/diff；历史 lcov 不绑定即 unknown。

## Implementation steps

```text
1. 完成 PHASE-04 Freeze Gate；caller_tests 必含 provider-graph.test.ts 与 spine.test.ts（若共享类型/函数被调用）。
2. 实现严格 lcov parser 与 companion binding；先判 alignment，再赋 observation。
3. 实现 literal side-effect detector；从 FunctionNode range 读取源码，越界/不可读只增加 unverified。
4. 实现 card renderer；输入只允许 TaskGraphV1+receipt，不回调采集层。
5. 实现 deep serializable guard、stable canonicalizer、三文件 staging/fsync/rename。
6. 注入 filesystem fault hooks 的测试标 FAKE-INJECTION；至少一项使用真实临时目录与真实 writeArtifacts。
7. all-pass fixture 先创建所有 lcov/source/graph/out 对象，再逐项 mutation。
8. 运行 Fixed verification；任何 partial final、额外诊断、allowed-file 外 diff 均停止。
```

## Check Registry

| Check name | Source of truth | Read/operation | PASS | Missing/corrupt behavior | Exact failure result |
|---|---|---|---|---|---|
| TL-COV-BIND | companion+lcov | hash/head/diff compare | ALIGNED | missing/mismatch degraded | `["TL-COV-BIND"]`, exit2 |
| TL-COV-FN | FN/FNDA | unique match | exact three-state | ambiguous unknown | `["TL-COV-FN"]` |
| TL-COV-DA | DA records | interval intersect | exact three-state | parse bad unknown | `["TL-COV-DA"]` |
| TL-EFFECT | source literals | range search | sorted heuristic list | source unreadable unverified | `["TL-EFFECT"]` |
| TL-CARD | rendered text | headings/rows | five sections nonempty | missing fatal21 | `["TL-CARD"]` |
| TL-CANON | graph value | deep guard+hash twice | identical/no non-JSON | invalid fatal21 | `["TL-CANON"]` |
| TL-ATOMIC | filesystem | staging/readback/rename | exactly 3 final files | unknown/partial fatal21 | `["TL-ATOMIC"]` |
| TL-CONFLICT | final dir | lstat | absent→write; present→reject | lstat error fatal21 | `["TL-CONFLICT"]` |
| TL-TSC-DELTA | tsc | baseline diff | zero new diagnostics | baseline missing FAIL | `["TL-TSC-DELTA"]` |

## All-pass Fixture

| Evidence object | Creation method | Required fields/data | Why required |
|---|---|---|---|
| TaskGraph | real graph builders | seed/edge/spine/unverified arrays | renderer input |
| FN lcov + companion | fixture files | unique FN/FNDA、matching hashes | path A |
| DA lcov + companion | fixture files | >0/all0/noDA ranges | path B |
| source files | temp project | builtin/config literal tokens | effects |
| external out | fresh temp sibling | writable parent、absent taskId | atomic writer |

## Single-failure Matrix

| Test ID | Baseline | Only mutation | Expected check | Exact failedChecks/error | Other checks |
|---|---|---|---|---|---|
| TL-C-301 | aligned FN | duplicate same name/line | TL-COV-FN | unknown only | true |
| TL-C-302 | aligned DA>0 | set all counts 0 | TL-COV-DA | not-observed | true |
| TL-C-303 | aligned companion | change diffHash | TL-COV-BIND | exit2/unknown | true |
| TL-C-304 | source with fetch | remove token | TL-EFFECT | NET absent only | true |
| TL-C-305 | valid graph | remove section data | TL-CARD | singleton/21 | true |
| TL-C-306 | plain graph | replace array with Map | TL-CANON | singleton/21 | true |
| TL-C-307 | fresh out | precreate taskId dir | TL-CONFLICT | singleton/21 | true |
| TL-C-308 | staging success | inject rename EACCES | TL-ATOMIC | singleton/21/no final | true |

## Fixed verification

```bash
cd /home/zhaoge/workspace/qoderwork/.worktrees/check-plan
test -s audits/task-lens-m1/evidence/pre-change-PHASE-04.json
bun test scripts/task-lens/__tests__/coverage-render.test.ts scripts/task-lens/__tests__/artifact-writer.test.ts
set +e
bun run typecheck > audits/task-lens-m1/evidence/typecheck-after-PHASE-04.txt 2>&1
typecheck_exit=$?
set -e
printf '\nTYPECHECK_EXIT=%s\n' "$typecheck_exit" >> audits/task-lens-m1/evidence/typecheck-after-PHASE-04.txt
test "$typecheck_exit" -eq 1
diff -u audits/task-lens-m1/evidence/typecheck-baseline-PHASE-02.txt audits/task-lens-m1/evidence/typecheck-after-PHASE-04.txt
git diff --check
git diff --exit-code -- bun.lock
rg -n '^## (一、主干|二、变更函数表|三、副作用表|四、证据|五、反馈区)' scripts/task-lens/__tests__
rg -n 'FAKE-INJECTION' scripts/task-lens/__tests__/artifact-writer.test.ts
```

- Required output/artifacts: 2 suites PASS、两类 lcov fixtures、card snapshot、atomic receipts、typecheck delta。
- Expected evidence level: component；degraded fixture 的 exit2 是预期负例，不是 M1 integration PASS。
- On non-zero/missing evidence: `BLOCKED`; preserve evidence; do not advance。

## Rollback/failure convergence

1. 仅撤销 6 个 Allowed files；删除仅由测试创建且 realpath 已验证的 staging temp，不删 final/外部证据。
2. 原子失败若 final 状态不明，标 `UNAVAILABLE` 并保留现场；禁止重试覆盖。

## Phase completion gate

- [ ] PHASE-04 Freeze Gate 与共享 caller tests 完整。
- [ ] coverage 两路径、未绑定降级、side-effect/card checks 全 PASS。
- [ ] canonical/atomic/conflict 单一 mutations 精确失败。
- [ ] 真实 writeArtifacts 路径覆盖；fake 均有 FAKE-INJECTION。
- [ ] typecheck 零新增、bun.lock 无 diff、Allowed-file diff only。
- [ ] PHASE-05 在全部勾选前保持 BLOCKED。
