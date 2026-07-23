# Phase PHASE-02: 输入契约、安全命令与差异提取 `[ANALYSIS→VERIFICATION]`

**Phase ID**: `PHASE-02`
**Depends on**: PHASE-01
**Outcome**: CLI 可安全冻结 working-tree/commit 输入，输出 canonical receipt 与完整 DiffModel，不构图、不写 artifact。
**Evidence level**: component

## Goal

- 实现 REQ-002/003/004 的唯一输入路径，并以安全负例证明任意字符串不能变成 shell、Git option 或项目内写入。

## Starting state and dependency

- Required status: PHASE-01 completion gate 全勾选。
- Required evidence: `scope-lock-PHASE-02.json`、`pre-change-PHASE-02.json`、typecheck baseline 均非空且 HEAD 一致。
- If absent: `BLOCKED`, do not continue。

## Local requirements

| Requirement | Condition | Required behavior | Observable result |
|---|---|---|---|
| REQ-002-A | mode=working-tree | base/head=HEAD；tracked diff+untracked full file | staged/unstaged/untracked 均进入模型 |
| REQ-002-B | mode=commit | base 为 full SHA、head=current HEAD、worktree clean | dirty/非 current head/`-` ref 拒绝 |
| REQ-002-C | rename/delete | 保留 old/new；纯删除写 DeletedRegion | 不创建 deleted live seed |
| REQ-003-A | 子进程 | `Bun.spawn` 固定 argv、shell=false、最小 env | 30s/5MiB/取消/非零均分类 |
| REQ-003-B | 路径/config | 绝对路径+realpath/symlink 边界；固定 YAML | project 内 out/正则/未知字段拒绝 |
| REQ-004-A | receipt/taskId | 固定字段 canonical JSON 后 SHA-256 | clock 不改变 taskId |
| REQ-004-B | CLI | generate(default)/feedback/metrics summarize | 其余组合 exit 10 |

## Allowed files

| Exact path | Change | Exact symbol/anchor |
|---|---|---|
| `package.json` | modify | `scripts.task-lens` |
| `scripts/task-lens/types.ts` | add | all exported M1 contracts |
| `scripts/task-lens/cli.ts` | add | `parseCli`, `main` |
| `scripts/task-lens/command-runner.ts` | add | `runCommand` |
| `scripts/task-lens/config.ts` | add | `resolveConfig` |
| `scripts/task-lens/diff-extractor.ts` | add | `extractDiff`, `createInputReceipt` |
| `scripts/task-lens/__tests__/input-diff.test.ts` | add | input/diff/receipt suites |
| `scripts/task-lens/__tests__/command-security.test.ts` | add | runner/path/config suites |

## Forbidden files and behaviors

- 禁止修改 `bun.lock`、work-one、`scripts/_b1_live.ts`、任何既有 test-serve 文件。
- 禁止 `shell:true`、命令字符串拼接、任意 regex/SQL、任意 historical head、默认 `/tmp`、自动创建 project 内 out。
- 本 Phase 禁止 CodeGraph 查询、卡片/artifact/metrics 写入；CLI generate 只可返回 `NOT_IMPLEMENTED_AFTER_INPUT` 的内部阻断结果，不能伪造成功卡。

## Fixed contract

- API/signature:
  - `runCommand(request: CommandRequest): Promise&lt;CommandResult&gt;`
  - `resolveConfig(projectRealpath: string, configPath?: string): Promise&lt;TaskLensConfigV1&gt;`
  - `extractDiff(input: DiffInput, runner: CommandRunner): Promise&lt;DiffModel&gt;`
  - `createInputReceipt(input: ReceiptInput, clock: Clock): TaskInputReceipt`
  - `parseCli(argv: string[]): CliRequest`
- Fields/states/check names:
  - `TaskLensConfigV1={schemaVersion:"task-lens.config/v1",entries:string[],sideEffectTokens:{kind:"DB"|"FS"|"NET"|"PROC",token:string}[]}`；未知字段/重复 token/空 token/regex 元字符作为普通 literal。
  - `GraphBudget={maxNodes:200,maxEdges:500,maxFanout:50,maxDisplayNodes:20}`，不可由 YAML 扩大。
  - `DiffInput={projectRealpath,mode:"working-tree"|"commit",baseSha?:string}`。
  - `DiffModel={mode,baseSha,headSha,hunks,untrackedFiles,renames,deletedRegions,diffHash}`；数组按 `path/startLine/endLine` 稳定排序。
  - `DiffHunk={oldPath,newPath,oldStart,oldLines,newStart,newLines,kind:"add"|"modify"|"delete"|"rename"}`。
  - `DeletedRegion={oldPath,startLine,endLine,excerptHash,provenance:"preimage-only"}`。
  - `TaskInputReceipt` 使用 blueprint 字段；另含 `configSchemaVersion` 与 `coverage:null`，`generatedAt` 不参与 taskId。
- canonical taskId: 对字段顺序固定的 UTF-8 compact JSON `{schemaVersion,projectRealpath,mode,baseSha,headSha,diffHash,configHash,coverageHash,provider}` 做 SHA-256 lowercase hex；先把 `taskId=""`、排除 `generatedAt`。
- Commands:
  - working-tree tracked: `git diff --find-renames --no-ext-diff --no-color --unified=0 HEAD --`
  - untracked list: `git ls-files --others --exclude-standard -z --`
  - commit: `git diff --find-renames --no-ext-diff --no-color --unified=0 BASE..HEAD --`
  - ref 先 `git rev-parse --verify REF^{commit}`；argv 中 `--` 终止 option。
- `CommandRequest` 只允许 executable=`git|codegraph`，timeoutMs 默认且最大 30000，maxStdoutBytes/maxStderrBytes 默认且最大 5242880；env allowlist=`PATH,HOME,USER,LANG,LC_ALL,TMPDIR`，删除 `NODE_OPTIONS,BASH_ENV,ENV,LD_PRELOAD,DYLD_INSERT_LIBRARIES,BUN_OPTIONS`。
- exit: 参数/config/path=10；空 diff=13；子进程失败/timeout/signal/truncate=20；未分类=1。
- Error/missing evidence behavior: stderr 非空但 exit0 可成功；任何输出截断先终止进程树再 FAIL。
- Negative states: Git 查询 exit1/128 属 `UNAVAILABLE`，不得解释为 `NOT_FOUND`；仅 `ls-files` 成功且空为 untracked `NOT_FOUND`。
- Current vs historical source: base/head/full diff 在本次 CLI 调用中观察；禁止复用日志 SHA。

## Implementation steps

```text
1. 验证 PHASE-02 receipt/lock；用 git diff --name-only 保存开始状态。
2. 在 types.ts 一次性定义本 Phase及后续 Phase 所需接口；仅类型，不写 I/O。
3. 实现 command-runner.ts：argv、env、timeout、byte limit、AbortSignal 后进程树终止；禁 shell。
4. 实现 config.ts：Bun.YAML.parse、exact-key validation、literal tokens、路径边界。
5. 实现 diff-extractor.ts：先解析 Git root/full SHA，再按 mode 执行固定命令，解析 hunks/rename/delete/untracked，canonical sort/hash。
6. 实现 createInputReceipt；用注入 clock 仅填 generatedAt，不参与 taskId。
7. 实现 parseCli 与 package script。generate 在下游未实现时明确 BLOCKED，不写 artifact。
8. 测试从临时 Git repo all-pass fixture 开始；每个负例只改变一个条件。
9. 对依赖注入测试添加 FAKE-INJECTION 注释；至少一项调用真实 runCommand。
10. 运行 Fixed verification；任一新增诊断/越界 diff 即停止。
```

## Check Registry

| Check name | Source of truth | Read/operation | PASS | Missing/corrupt behavior | Exact failure result |
|---|---|---|---|---|---|
| TL-DIFF-WT | fixture Git | working-tree extract | 三类变更齐全 | Git不可用 FAIL | `["TL-DIFF-WT"]` |
| TL-DIFF-COMMIT | clean fixture | commit extract | full SHA/current HEAD | dirty/ref错 FAIL | `["TL-DIFF-COMMIT"]` |
| TL-DIFF-DELETE | patch/preimage | parse DeletedRegion | hash/range/provenance | preimage缺 FAIL | `["TL-DIFF-DELETE"]` |
| TL-CMD-ARGV | spawn receipt | inspect cmd/shell | argv 固定、shell false | receipt缺 FAIL | `["TL-CMD-ARGV"]` |
| TL-CMD-RESOURCE | runner | timeout/limit tests | exact ProcessFailure | 未终止 FAIL | `["TL-CMD-RESOURCE"]` |
| TL-PATH-OUT | filesystem | realpath test | out 严格在 project 外 | parent/symlink不可读 FAIL | `["TL-PATH-OUT"]` |
| TL-CONFIG | parsed YAML | exact schema | 仅固定 keys/literals | parse/unknown FAIL | `["TL-CONFIG"]` |
| TL-RECEIPT | two receipts | compare hashes | clock only differs | field缺 FAIL | `["TL-RECEIPT"]` |
| TL-CLI | argv matrix | parse result | 唯一 subcommand grammar | unknown FAIL | `["TL-CLI"]` |
| TL-TSC-DELTA | tsc outputs | exact diff | 无新增诊断 | baseline缺 FAIL | `["TL-TSC-DELTA"]` |

## All-pass Fixture

| Evidence object | Creation method | Required fields/data | Why required |
|---|---|---|---|
| temporary Git repo | `mkdtempSync`+git argv | initial commit、staged/unstaged/untracked/rename/delete | diff truth |
| external out parent | sibling temp dir | existing realpath、non-project | path gate |
| config YAML | test fixture string | schemaVersion/entries/literal tokens | config |
| command receipt | real `git --version` | argv/exit/stdout/stderr/duration/truncation flags | real runner |
| receipt pair | same inputs, two clocks | all input hashes/provider placeholder | determinism |

## Single-failure Matrix

| Test ID | Baseline | Only mutation | Expected check | Exact failedChecks/error | Other checks |
|---|---|---|---|---|---|
| TL-C-101 | mixed repo | remove live file, keep deletion | TL-DIFF-DELETE | singleton | true |
| TL-C-102 | safe command | executable=`bash` | TL-CMD-ARGV | `exit=20` | true |
| TL-C-103 | external out | symlink out→project | TL-PATH-OUT | `exit=10` | true |
| TL-C-104 | valid YAML | add `regex` key | TL-CONFIG | `exit=10` | true |
| TL-C-105 | clean commit | add dirty file | TL-DIFF-COMMIT | `exit=10` | true |
| TL-C-106 | two receipts | change generatedAt only | TL-RECEIPT | hashes remain equal | true |
| TL-C-107 | runner success | stdout=5MiB+1 | TL-CMD-RESOURCE | `exit=20/truncated` | true |
| TL-C-108 | valid argv | `--base=-x` | TL-CLI | `exit=10` | true |

## Fixed verification

```bash
cd /home/zhaoge/workspace/qoderwork/.worktrees/check-plan
test -s audits/task-lens-m1/evidence/pre-change-PHASE-02.json
bun test scripts/task-lens/__tests__/input-diff.test.ts scripts/task-lens/__tests__/command-security.test.ts
set +e
bun run typecheck > audits/task-lens-m1/evidence/typecheck-after-PHASE-02.txt 2>&1
typecheck_exit=$?
set -e
printf '\nTYPECHECK_EXIT=%s\n' "$typecheck_exit" >> audits/task-lens-m1/evidence/typecheck-after-PHASE-02.txt
test "$typecheck_exit" -eq 1
diff -u audits/task-lens-m1/evidence/typecheck-baseline-PHASE-02.txt audits/task-lens-m1/evidence/typecheck-after-PHASE-02.txt
git diff --check
git diff --name-only -- package.json scripts/task-lens
git diff --exit-code -- bun.lock
rg -n 'shell\\s*:\\s*true|execSync|process\\.env\\.(NODE_OPTIONS|BASH_ENV|LD_PRELOAD)' scripts/task-lens && exit 1 || true
rg -n 'runCommand|extractDiff|createInputReceipt' scripts/task-lens --glob '*.ts'
```

- Required output/artifacts: 2 test suites PASS、typecheck delta empty、allowed-file diff、caller scan。
- Expected evidence level: component；不得声明 integration。
- On non-zero/missing evidence: `BLOCKED`; preserve evidence; do not advance。

## Rollback/failure convergence

1. 仅撤销本 Phase 8 个 allowed files 的本次 edits；保留测试/typecheck/receipt 输出。
2. 禁止删除 fixture 之外的 Git 路径、修改基线诊断或放宽安全检查来求绿。

## Phase completion gate

- [ ] Freeze Gate receipt 有效且 HEAD 未漂移。
- [ ] REQ-002/003/004 的 checks、all-pass、单一 mutation 全通过。
- [ ] 至少一个测试走真实 runCommand；所有 fake 有 FAKE-INJECTION 标注。
- [ ] typecheck 相对 BASELINE-TS-001 零新增诊断，git diff check 通过。
- [ ] 仅 8 个 Allowed files 有 diff，`bun.lock` 未变。
- [ ] PHASE-03 在全部勾选前保持 BLOCKED。
