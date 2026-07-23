# Phase PHASE-03: StructureProvider、调用图与单卡 SpineForest `[ANALYSIS→VERIFICATION]`

**Phase ID**: `PHASE-03`
**Depends on**: PHASE-02
**Outcome**: 从 live hunks 得到 calls-only bounded TaskGraph 与单一 SpineForest；不读取 coverage、不写卡片。
**Evidence level**: component

## Goal

- 实现 REQ-005/006/007；DB/CLI 任一路缺乏确定性时 fail-closed，禁止把 references 或模糊同名结果当调用事实。

## Starting state and dependency

- Required status: PHASE-02 completion gate 全勾选。
- Required evidence: auditor 新建并由 Human reviewer 批准 `scope-lock-PHASE-03.json`，随后生成非空 `pre-change-PHASE-03.json`；repository HEAD 等于 PHASE-02 accepted HEAD。
- If absent: `BLOCKED`, do not continue。

## Local requirements

| Requirement | Condition | Required behavior | Observable result |
|---|---|---|---|
| REQ-005-A | DB provider | readonly 打开目标 `.codegraph/codegraph.db` 并 probe | required tables/columns/version receipt 完整 |
| REQ-005-B | DB capability 不足 | 固定 CLI fallback；歧义即 unavailable | 双路失败 exit 12、不出图 |
| REQ-006-A | live hunks | 与 current function/method range 求交 | live seeds 稳定去重 |
| REQ-006-B | edges | 仅 calls+function/method；无自环/无位置边 | metadata 保留，低置信度 static-low |
| REQ-007-A | graph search | maxNodes=200/maxEdges=500/maxFanout=50 | 达限停止且记录具体 truncation |
| REQ-007-B | single card spine | entry precedence 与稳定 tie-break | 显示≤20，余 seed 在 uncoveredSeeds |

## Allowed files

| Exact path | Change | Exact symbol/anchor |
|---|---|---|
| `scripts/task-lens/codegraph-provider.ts` | add | `CodeGraphProvider`, `CliStructureProvider` |
| `scripts/task-lens/seed-resolver.ts` | add | `resolveSeeds` |
| `scripts/task-lens/graph-builder.ts` | add | `buildGraph`, `filterEdges` |
| `scripts/task-lens/spine.ts` | add | `buildSpineForest` |
| `scripts/task-lens/presets/work-one.yaml` | add | config v1 root |
| `scripts/task-lens/__tests__/provider-graph.test.ts` | add | provider/seed/edge/budget suites |
| `scripts/task-lens/__tests__/spine.test.ts` | add | path/branch/uncovered suites |

## Forbidden files and behaviors

- 禁止修改 PHASE-02 files、work-one、目标 `.codegraph` DB、`bun.lock`。
- 禁止运行 `codegraph sync/index/init`；provider 只读，pending/mismatch 不自修。
- 禁止接受 ambiguous CLI symbol、parse 人类文本为 endLine、references/imports/contains、自环、无 file position edge。
- 禁止多卡、LLM、coverage、artifact/metrics；显示预算不得由 config 提高。

## Fixed contract

- API/signature:
  - blueprint `StructureProvider` 原签名不变。
  - `CodeGraphProvider.open(projectRealpath:string): Promise&lt;StructureProvider&gt;`
  - `resolveSeeds(hunks:DiffHunk[], ranges:FunctionRange[]): SeedResolution`
  - `buildGraph(provider,seeds,budget): Promise&lt;GraphResult&gt;`
  - `buildSpineForest(graph,seeds,entries,budget): SpineForest`
- Provider DB capability:
  - path=`projectRealpath + "/.codegraph/codegraph.db"`，`Database(...,{readonly:true,strict:true})`。
  - tables=`nodes,edges,schema_versions,project_metadata`。
  - `nodes` required=`id,kind,name,qualified_name,file_path,start_line,end_line,signature`。
  - `edges` required=`source,target,kind,metadata`；metadata JSON 允许且仅读取 `confidence:number|null,resolvedBy:string|null`。
  - receipt=`{provider:"codegraph-sqlite",schemaVersions:number[],indexedWithVersion:string|null,extractionVersion:string|null,capabilityHash}`。
- DB queries 使用参数绑定；range 仅取 exact changed file_path 且 kind IN (`function`,`method`)；edge 以 source/target IDs 参数化，禁止用户 SQL。
- CLI fallback:
  1. `codegraph status --path PROJECT` 必须 up-to-date。
  2. 每文件 `codegraph node --path PROJECT --file FILE --symbols-only` 取得 function/method 名单。
  3. 每名称 `codegraph query --path PROJECT --json --limit 100 NAME`；只接受 exact name+filePath+kind 唯一 row。
  4. callers/callees 用唯一 name 的 `--json --limit 50`；名称跨文件不唯一或输出缺字段即 `UNAVAILABLE`。
  5. metadata 在 CLI 结果不可得时固定 `confidence=null,resolvedBy="codegraph-cli"` 并列入 `unverified`，不得冒充 DB confidence。
- Seed overlap: add/modify 用 `[newStart,newStart+newLines-1]` 与 range inclusive 相交；newLines=0 不得产生 live seed。每 seed 记录 `hunkIds`，按 `file,startLine,endLine,id` 排序。
- Edge filter 顺序固定：kind calls → endpoint kinds → target file/range present → remove self-loop → stable dedup `(from,to)` → metadata label；confidence<0.8=`static-low`。
- Search: 从 seeds 双向 BFS；每 node 的候选边先按 `to/from file,startLine,id` 排序；fanout 先截 50，再累计 200 nodes/500 edges；每种截断写 literal `MAX_FANOUT/MAX_NODES/MAX_EDGES`。
- Entry precedence: CLI `--entry` exact IDs > config entries exact `file#name` > 搜索图中距任一 seed 最大 caller；tie-break 依次为覆盖 seed 数降序、路径长度升序、node-id 序。
- SpineForest 单一：`primaryPath` 取最佳；branches 按 `from,path,seedIds` 排序加入直到 union display node=20；未加入 seed 进入 `uncoveredSeeds`；超限时 `collapsedCount>0`、truncation 含 `MAX_DISPLAY_NODES`、最终 exit 2。
- Error/missing evidence behavior: schema/JSON/CLI/歧义/pending 均 `providerState=UNAVAILABLE`, exit 12；零 live seed 由下游生成 degraded 说明，不能造 seed。
- Negative states: DB/CLI query 成功且 exact row absent 才 `NOT_FOUND`；query/parse/ambiguity 为 `UNAVAILABLE`。
- Current vs historical source: 每次 provider open 的 status/schema/project metadata receipt；禁止使用 blueprint 的 schema 数字代替 probe。

## Implementation steps

```text
1. 完成 PHASE-03 独立 Freeze Gate；scope-lock impact_analysis 扫描 PHASE-02 新共享函数及 caller tests。
2. 用临时 SQLite all-pass fixture 实现 readonly capability probe 与参数化 DB provider。
3. 实现 CLI fallback；所有 text/JSON parse 使用 exact grammar，任一歧义返回 UNAVAILABLE。
4. 实现 resolveSeeds inclusive overlap、dedup/sort；delete-only 只保留已有 DeletedRegion。
5. 实现 calls-only filter 与双向 bounded BFS；先单边 fanout 再全局预算。
6. 实现单一 SpineForest、entry precedence、稳定 tie-break、20-node gate 与 uncoveredSeeds。
7. 写 work-one preset：schemaVersion、明确 entries 与 literal sideEffectTokens；不得含 regex。
8. 测试 fake provider 上方写 FAKE-INJECTION；至少一个 DB fixture 调真实 CodeGraphProvider，至少一个测试串联真实 resolveSeeds→buildGraph→buildSpineForest。
9. 运行 Fixed verification；新增诊断、越界 diff或 coupled failure 均停止。
```

## Check Registry

| Check name | Source of truth | Read/operation | PASS | Missing/corrupt behavior | Exact failure result |
|---|---|---|---|---|---|
| TL-PROBE | SQLite schema | readonly PRAGMA/select | fields+versions receipt | DB/table/column FAIL | `["TL-PROBE"]` |
| TL-FALLBACK | CLI outputs | fixed commands/parse | 唯一 rows | ambiguity/parse FAIL | `["TL-FALLBACK"]` |
| TL-SEED | hunks+ranges | interval join | exact stable seeds | range缺 FAIL | `["TL-SEED"]` |
| TL-EDGE-KIND | edge rows | fixed filter | calls-only endpoint-valid | metadata坏 FAIL | `["TL-EDGE-KIND"]` |
| TL-EDGE-META | metadata | JSON parse | confidence/resolvedBy retained | parse FAIL | `["TL-EDGE-META"]` |
| TL-GRAPH-BUDGET | graph | BFS counters | limits不超且truncation准确 | counter缺 FAIL | `["TL-GRAPH-BUDGET"]` |
| TL-SPINE | graph | deterministic paths | primary/branches stable | entry坏 FAIL | `["TL-SPINE"]` |
| TL-DISPLAY | spine | distinct node count | ≤20+uncovered | missing list FAIL | `["TL-DISPLAY"]` |
| TL-TSC-DELTA | tsc | compare baseline | 零新增 | baseline缺 FAIL | `["TL-TSC-DELTA"]` |

## All-pass Fixture

| Evidence object | Creation method | Required fields/data | Why required |
|---|---|---|---|
| SQLite CodeGraph DB | temp DB schema v8-like | required tables/columns、calls/reference/self edges | real provider |
| CLI result bundle | fake runner fixture | status/node/query/callers/callees exact outputs | fallback |
| DiffModel | PHASE-02 real builder | add/modify/delete hunks | seed join |
| bounded graph | deterministic node/edge set | branches/cycle/low confidence | filters/budget |
| config entries | preset fixture | exact and missing entry cases | precedence |

## Single-failure Matrix

| Test ID | Baseline | Only mutation | Expected check | Exact failedChecks/error | Other checks |
|---|---|---|---|---|---|
| TL-C-201 | valid DB | remove `edges.metadata` | TL-PROBE | singleton/exit12 | true |
| TL-C-202 | valid fallback | duplicate exact symbol | TL-FALLBACK | singleton/UNAVAILABLE | true |
| TL-C-203 | live hunk | set newLines=0 | TL-SEED | NOT_FOUND seed | true |
| TL-C-204 | calls graph | edge kind=references | TL-EDGE-KIND | edge excluded | true |
| TL-C-205 | confidence .9 | change to .7 | TL-EDGE-META | static-low only | true |
| TL-C-206 | 200 nodes | add node 201 | TL-GRAPH-BUDGET | MAX_NODES/exit2 | true |
| TL-C-207 | display 20 | add distinct node 21 | TL-DISPLAY | uncovered+exit2 | true |
| TL-C-208 | unique entry | make CLI entry unknown | TL-SPINE | exact entry error | true |

## Fixed verification

```bash
cd /home/zhaoge/workspace/qoderwork/.worktrees/check-plan
test -s audits/task-lens-m1/evidence/pre-change-PHASE-03.json
bun test scripts/task-lens/__tests__/provider-graph.test.ts scripts/task-lens/__tests__/spine.test.ts
set +e
bun run typecheck > audits/task-lens-m1/evidence/typecheck-after-PHASE-03.txt 2>&1
typecheck_exit=$?
set -e
printf '\nTYPECHECK_EXIT=%s\n' "$typecheck_exit" >> audits/task-lens-m1/evidence/typecheck-after-PHASE-03.txt
test "$typecheck_exit" -eq 1
diff -u audits/task-lens-m1/evidence/typecheck-baseline-PHASE-02.txt audits/task-lens-m1/evidence/typecheck-after-PHASE-03.txt
git diff --check
git diff --exit-code -- bun.lock
rg -n 'new Database|codegraph (status|node|query|callers|callees)|resolveSeeds|buildGraph|buildSpineForest' scripts/task-lens --glob '*.ts'
rg -n 'FAKE-INJECTION' scripts/task-lens/__tests__/provider-graph.test.ts scripts/task-lens/__tests__/spine.test.ts
```

- Required output/artifacts: 2 suites PASS、DB/CLI receipts、budget diagnostics、typecheck delta、caller scan。
- Expected evidence level: component；work-one真实查询留到 PHASE-06。
- On non-zero/missing evidence: `BLOCKED`; preserve evidence; do not advance。

## Rollback/failure convergence

1. 仅撤销 7 个 Allowed files 的本次 edits；保留 DB/CLI fixture 与输出。
2. provider `UNAVAILABLE` 时禁止 sync/index 或退化为 references；报告 exit 12。

## Phase completion gate

- [ ] PHASE-03 Freeze Gate 与 impact caller tests 完整。
- [ ] TL-PROBE/FALLBACK/SEED/EDGE/BUDGET/SPINE/DISPLAY 全 PASS。
- [ ] 真实 SQLite provider 与真实 seed→graph→spine 路径各有覆盖。
- [ ] 每个 fake 有 FAKE-INJECTION，单一 mutation 只失败一个 check。
- [ ] typecheck 零新增、bun.lock 无 diff、Allowed-file diff only。
- [ ] PHASE-04 在全部勾选前保持 BLOCKED。
