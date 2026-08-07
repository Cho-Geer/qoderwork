# Phase PHASE-06-v2: Fixture Integration 与双目标零写入（双环境）

**Phase ID**: `PHASE-06-v2`
**Depends on**: PHASE-05-v2 ACCEPTED（双端）
**Outcome**: 完整 CLI 在 fixture、work-one、qoderwork-main 三类当前输入上产出可核验 artifact；两个真实目标无内容写入；evidence 双端独立；每 REQ 两个固定 case（WSL + Git Bash）汇总到单一 canonical outcome-run-result-v2.json
**Evidence level**: integration + manual review
**Progression status**: `BLOCKED`（等 PHASE-05-v2 ACCEPTED 后由独立 session 派遣）

> 本 phase 不是 `plans/task-lens-m1/06-phase-integration-zero-write.md` 的修改或替代品。两份文件并存；predecessor 状态分裂不裁决（DEC-V2-009）；v2 显式新增双环境约束 + gen2 outcome case 建模。

## 1. Goal

- 实现 REQ-013v2：在 WSL Ubuntu-24.04 native FS 与 Windows Git Bash 各采集 fixture integration + 双真实目标零写入 evidence；
- real-target before/after hash 比较覆盖 status / trackedContent / nonToolTree / fileCount 四类；
- 不冒充双端任一端 evidence 跨越到另一端；两 case verdict 独立汇总到单一 canonical run-result；任一 case FAIL = 整体 FAIL。

## 2. Starting state and dependency

- Required status: PHASE-05-v2 双端 completion gate 全勾选；
- Required evidence（v2 实施阶段采集）：
  - 双端各 human-approved scope-lock 各一份（落盘到 gen2 evidence root — DEC-V2-010）；
  - 双端 real-target `codegraph status` 均 up-to-date（WSL 端与 Git Bash 端各做一次）；
- If absent: `BLOCKED`, do not continue。

## 3. 双环境 acceptance matrix

| 维度 | WSL Ubuntu-24.04 native FS | Windows Git Bash |
|---|---|---|
| Fixture working-tree repo | `${RUN_ROOT}/fixture-wt`（POSIX path） | `%RUN_ROOT%\fixture-wt`（Git Bash 看到 POSIX-like via MSYS mount） |
| Fixture commit repo | `${RUN_ROOT}/fixture-commit` | `%RUN_ROOT%\fixture-commit` |
| Real target: work-one | `${WORK_ONE}` (POSIX path；anchor 解析) | Git Bash 通过同一 `WORK_ONE` 解析（POSIX-like） |
| Real target: qoderwork-main | `${QODERWORK_MAIN}` | 同上 |
| Real-target evidence root | `${HOME}/.local/state/qoderwork/task-lens/m1-validation/PHASE-06-v2` | `%LOCALAPPDATA%\qoderwork\task-lens\m1-validation\PHASE-06-v2` |
| mkdir 路径契约 | `mkdir -p <anchor>` | `mkdir -p "$LOCALAPPDATA/qoderwork/task-lens/m1-validation/PHASE-06-v2"` 或 cygpath 转换；**禁止 PowerShell** |
| target snapshot path | POSIX | Win32（Git Bash 视角下也是 POSIX-like，但 realpath() 输出 Win32） |
| mode selection | `git status --porcelain=v1 -z --untracked-files=all` | 同命令；字节形态需 `-z` 显式 |
| before/after hash 字节比对 | `sha256sum` | `sha256sum`（Git Bash 自带） |
| `--out` realpath 检查 | realpath 必须不在任一 target 内 | 同；Win32 realpath 解析 |
| TL-ZERO-WRITE verdict | NOT_FOUND / FOUND / UNAVAILABLE | 同；不外推到 PASS |
| outcome case | REQ-013v2 WSL case | REQ-013v2 Git Bash case |

## 4. Local requirements

| ID | Condition | Required behavior | Observable result | 双端 case |
|---|---|---|---|---|
| REQ-013v2-A | fixture working-tree | tracked+untracked 生成；pure delete degraded | 三 artifact/metrics 与 exit 0/2 一致 | REQ-013v2-{WSL,GITBASH} |
| REQ-013v2-B | fixture commit | clean base..HEAD 稳定；dirty 拒绝 | 两次 TaskGraph canonical hash 相等 | 同上 |
| REQ-013v2-C | coverage/provider | DB path/FN/DA/unaligned/fallback 组合 | receipt/provider/observation 三态正确 | WSL only（Git Bash SQLite path-replace 行为不等价，本端可标 N/A-EXPLAINED 并记录） |
| REQ-013v2-D | safety | project out/symlink/existing artifact/双 provider fail | exact exit 10/12/21 | REQ-013v2-{WSL,GITBASH} |
| REQ-013v2-E | work-one | 当前 change-set 出卡 | 五节、low confidence、unverified 可人工读 | 同上 |
| REQ-013v2-F | qoderwork-main | 当前 change-set 出卡 | 第二已索引 TS 项目成功 | 同上 |
| REQ-013v2-G | target purity | 运行前后 status/tree hash 相等 | 两真实目标 `NOT_FOUND` writes | 同上 |
| REQ-013v2-H | dual case per REQ | 两端 case 各自 verdict；任一 FAIL = 整体 FAIL | 单 canonical run-result 汇总 | cross-case |

## 5. Allowed files（本 phase 实施阶段；本轮 plan 仅声明不修改）

| Exact path | Change | Exact symbol/anchor | 双端 |
|---|---|---|---|
| `plans/task-lens-m1-completion-v2/06-phase-integration-zero-write.md` | add（本轮新建） | 本文件 | n/a |
| `scripts/task-lens/__tests__/integration.test.ts`（future, v2 实施） | add | fixture + dual real-target integration suites | 两端各跑 |
| `scripts/task-lens/README.md`（future, v2 实施） | modify | integration/dogfood evidence procedure | 两端共用 |

### 5.1 Frozen caller tests（只读回归，可运行不可修改 — H4）

同 §5.1 of `05-phase-metrics-feedback.md`；新增 `integration.test.ts` 不得修改 frozen 文件本体。

### 5.2 v2 allowed modified tests

- `scripts/task-lens/__tests__/integration.test.ts`（新增）。

### 5.3 Globally forbidden changes

- frozen predecessor 全部（与 phase 05-v2 同清单）；
- 禁止为 integration 失败修改生产文件（CLI/provider/coverage/renderer/artifact-writer/metrics/cli-integration/metrics.test）；
- 禁止执行 `codegraph sync/index/init`、创建目标项目文件、使用目标项目内 out、裸服务、LLM、固定 `/tmp`；
- 禁止跳过真实目标 suite、把 test skip 当 PASS、忽略 before/after hash/status 差异；
- 禁止清理失败 run 的 evidence；禁止修改 work-one/qoderwork-main dirty state；
- 禁止把 WSL evidence 复制到 Git Bash 路径下作为"Git Bash PASS"；
- 禁止创建 `outcome-run-result.gitbash.json` 自创模型（DEC-V2-008）；
- 禁止作为 evidence root 引用 / 不得写入 legacy `audits/**` 任何文件（DEC-V2-010）；
- 禁止 `validate-audit.ts` 与 P-01..P-07 v2.1 audit 模板。

## 6. Fixed contract

### 6.1 API/signature

```ts
type TargetSnapshot = {
  realpath: string
  head: string
  statusSha256: string
  trackedContentSha256: string
  nonToolTreeSha256: string
  fileCount: number
  env: "wsl" | "gitbash"
}
hashTargetTree(project: string): Promise<TargetSnapshot>
runRealTarget(case: RealTargetCase): Promise<RealTargetReceipt>
```

### 6.2 Real targets（双端同一组）

- `WORK_ONE = resolveAnchor("WORK_ONE_ROOT")` — 通过 `scripts/lib/workspace-paths.ts` 4 级优先级解析，不写死；
- `QODERWORK_MAIN = resolveAnchor("QODERWORK_ROOT")` — 同上；
- 当前实施 repo = 本 worktree；不计为第二目标。

### 6.3 Mode selection（双端同语义；WSL 优先实现）

1. `git status --porcelain=v1 -z --untracked-files=all` 非空 → `working-tree`；
2. 空 → `commit`，base = `git rev-parse HEAD^`；无 parent → `BLOCKED`；
3. 两分支都要求当前 HEAD 的 CodeGraph DB provider capability PASS；**不允许** CLI fallback 作为真实目标成功证据（双端硬约束）。

### 6.4 TargetSnapshot（双端各生成；env 字段由 caller 注入）

- `realpath`: 双端各自的 realpath 字节；不可翻译；
- `head`: `git rev-parse HEAD`；
- `statusSha256`: 完整 porcelain `-z` bytes 的 SHA-256；
- `trackedContentSha256`: `git ls-files -z` 文件 path+content hash 排序后 SHA-256；
- `nonToolTreeSha256`: 遍历项目全部 regular files/symlinks（排除 `.git/**`、`.codegraph/**`），记录 relative path/type/target-or-content hash 排序后 SHA-256；unreadable = `UNAVAILABLE`；
- `fileCount`: 上述 nonTool 数量；
- `env`: `wsl` 或 `gitbash`。

### 6.5 RealTargetReceipt

```ts
type RealTargetReceipt = {
  target: "work-one" | "qoderwork-main"
  before: TargetSnapshot
  after: TargetSnapshot
  mode: "working-tree" | "commit"
  baseSha: string
  headSha: string
  outRealpath: string
  taskId: string
  exitCode: number
  artifactHashes: { card: string; graph: string; receipt: string }
  metricsLine: string
  writeState: "NOT_FOUND" | "FOUND" | "UNAVAILABLE"
  env: "wsl" | "gitbash"
}
```

### 6.6 Evidence out root（双端独立）

- WSL: `${HOME}/.local/state/qoderwork/task-lens/m1-validation/PHASE-06-v2`
- Git Bash: `%LOCALAPPDATA%\qoderwork\task-lens\m1-validation\PHASE-06-v2`
- 每次 test run id 依次连接 `targetName,headSha,ISO-basic,randomUUID`；test 打印 exact path；
- out 必须 realpath 严格不在任一 target 内；失败 evidence 不删除。

### 6.7 Fixture integration（双端共用 test code + 各跑）

- test 用 temp Git repo 与最小真实 CodeGraph SQLite schema；fixture 内 `.codegraph` 是测试输入，允许创建；
- working-tree all-pass 包含 staged、unstaged、untracked、rename、function add；delete-only 单独 run exit 2；
- commit all-pass 有 base/head 两 commit、clean tree；重复运行使用不同 out 但 TaskGraph canonical hash（排除 receipt generatedAt/out path）相等；
- provider fallback 的 CLI 输出使用 fixture executable/runner，标 FAKE-INJECTION；真实目标必须 DB provider。

### 6.8 Current observation

- 每个 real run 重新读取 DB schema/project metadata 与 Git state；
- 运行前 `codegraph status` 仅作 precondition，完成后才捕获 before snapshot；task-lens 本身不得调用 fallback。

### 6.9 Manual card oracle（双端各 review）

- 五标题 exact；
- 每个 seed 有函数/DeletedRegion；
- static-low、unknown、uncovered/truncation 只在事实存在时出现；
- reviewer 记录 `PASS/FAIL`，不得据模板自签；
- 双端 reviewer 独立签名（不共用 reviewer 凭证）。

### 6.10 Negative states

- write PASS 仅 before/after 两组 hash 全等且 query succeeded；
- 缺 hash/权限/异常均不是 `NOT_FOUND`；
- 双端任一端 writeState=FOUND → 该端 case FAIL；不可把另一端 case verdict 覆盖。

## 7. Implementation steps（v2 实施阶段；本轮 plan 仅设计）

```text
1. 完成 PHASE-06-v2 双端 Freeze Gate；caller_tests 必须列出此前 6 个 frozen task-lens test files + v2 新增 metrics.test / cli-integration.test。
2. integration.test.ts 先实现 fixture repo/DB/coverage/out factory；所有对象由 test 创建并登记。
3. 写 fixture working-tree、commit、pure-delete、coverage、provider fallback、安全负例；禁止依赖用户仓库。
4. 实现 target snapshot；在一个故意写入 fixture 的敏感反例中证明 TL-ZERO-WRITE-v2 会 FAIL。
5. 实现两个 real target cases；status 非空走 working-tree，空走 commit HEAD^。
6. 在启动 task-lens 前捕获 before；完成并 read-back artifacts/metrics 后捕获 after，再比较。
7. 双端 Human reviewer 人工读两张 card 并在 external evidence 写 review receipt（双端各两份）；agent 不代签。
8. README 写 exact 命令、evidence root、mode selection、失败保留规则。
9. 双端分别运行 fixed verification；任何 skip、target hash drift、UNAVAILABLE、额外诊断立即停止。
10. 双端 case verdict 独立写盘；汇总到单一 canonical outcome-run-result-v2.json（gen2 outcome bundle）；任一 case FAIL = 整体 FAIL。
11. gen2 outcome 阶段：更新 gen2 contract/spec-v2/bundle-v2 + 创建 amendment-v2/approval-v2/ledger event-004/runs/outcome-run-result-v2.json；event-003+004 在 PHASE-05-v2 后已创建，本 phase 更新 event-004 run_ref。
```

## 8. Check Registry

| Check name | Source of truth | Read/operation | PASS | Missing/corrupt behavior | Exact failure result | 双端 case 映射 |
|---|---|---|---|---|---|---|
| TL-INT-WT-v2 | fixture artifacts | full CLI readback | tracked+untracked complete | object 缺 FAIL | `["TL-INT-WT-v2"]` | REQ-013v2-{WSL,GITBASH} |
| TL-INT-COMMIT-v2 | two fixture runs | canonical hash compare | exact equal | dirty/hash 缺 FAIL | `["TL-INT-COMMIT-v2"]` | 同上 |
| TL-INT-DELETED-v2 | delete-only run | graph/card/exit | DeletedRegion + exit 2 | live seed 伪造 FAIL | `["TL-INT-DELETED-v2"]` | 同上 |
| TL-INT-COVERAGE-v2 | aligned/unaligned runs | observations/receipt | exact three-state | proof 缺 degraded | `["TL-INT-COVERAGE-v2"]` | WSL only（Git Bash 端标 N/A-EXPLAINED） |
| TL-INT-SAFETY-v2 | negative runs | exits/no final | 10/12/21 exact | evidence 缺 FAIL | `["TL-INT-SAFETY-v2"]` | REQ-013v2-{WSL,GITBASH} |
| TL-WORK-ONE-v2 | real receipt | artifact/card/metrics | valid current run | unavailable FAIL | `["TL-WORK-ONE-v2"]` | 同上 |
| TL-QODERWORK-v2 | real receipt | artifact/card/metrics | valid current run | unavailable FAIL | `["TL-QODERWORK-v2"]` | 同上 |
| TL-ZERO-WRITE-v2 | snapshots | all hash compares | writeState NOT_FOUND | compare unavailable FAIL | `["TL-ZERO-WRITE-v2"]` | 同上 |
| TL-MANUAL-CARD-v2 | human receipt | five-section review | both PASS | missing BLOCKED | `["TL-MANUAL-CARD-v2"]` | 同上 |
| TL-TSC-DELTA-v2 | tsc | baseline diff | exit 0（v2 严格） | exit≠0 FAIL | `["TL-TSC-DELTA-v2"]` | n/a |
| TL-DUAL-CASE-v2 | single canonical run-result | case_results[] 含两端 case | both PASS | one FAIL = 整体 FAIL | `["TL-DUAL-CASE-v2"]` | 跨 case |

## 9. All-pass Fixture（双端各一份）

| Evidence object | Creation method | Required fields/data | Why required |
|---|---|---|---|
| working-tree repo | temp Git + SQLite DB | all diff classes/functions | full generate |
| commit repo | two commits/clean | deterministic base/head | repeatability |
| lcov pair | aligned FN/DA + unaligned | companion hashes | coverage |
| external evidence root | state path | unique run dirs | retention |
| two target snapshots | real read-only traversal | before/after all fields + env | zero-write |
| manual reviews | Human reviewer | target/taskId/card hash/verdict/env | readability |

## 10. Single-failure Matrix

| Test ID | Baseline | Only mutation | Expected check | Exact failedChecks/error | 双端 |
|---|---|---|---|---|---|
| TL-I-501-v2-{WSL,GITBASH} | WT fixture | remove untracked node | TL-INT-WT-v2 | singleton | both |
| TL-I-502-v2-{WSL,GITBASH} | clean commit | add dirty file | TL-INT-COMMIT-v2 | exit10 | both |
| TL-I-503-v2-{WSL,GITBASH} | delete-only | inject fake live seed | TL-INT-DELETED-v2 | singleton | both |
| TL-I-504-v2-WSL | aligned lcov | change companion head | TL-INT-COVERAGE-v2 | exit2/unknown | WSL only |
| TL-I-505-v2-{WSL,GITBASH} | external out | symlink into project | TL-INT-SAFETY-v2 | exit10/no final | both |
| TL-I-506-v2-{WSL,GITBASH} | valid target | write one sentinel file in fixture | TL-ZERO-WRITE-v2 | FOUND | both |
| TL-I-507-v2-{WSL,GITBASH} | valid snapshot | make one file unreadable | TL-ZERO-WRITE-v2 | UNAVAILABLE | both |
| TL-I-508-v2-{WSL,GITBASH} | real receipt | remove card heading in copy | TL-MANUAL-CARD-v2 | human FAIL | both |
| TL-I-509-v2-{WSL,GITBASH} | dual cases per REQ | inject one FAIL case | TL-DUAL-CASE-v2 | 整体 FAIL（不允许单端 PASS） | cross-env |

## 11. Fixed verification

### 11.1 命令清单（含 preflight `[POST-IMPLEMENTATION; CURRENTLY NON-EXISTENT]` 标注）

```bash
# WSL Ubuntu-24.04 native FS

# preflight: confirm files exist
for f in .agents/skills/deterministic-implementation-planning/scripts/validate-plan.ts \
         scripts/validate-outcome-governance.ts \
         scripts/task-lens/__tests__/integration.test.ts ; do
  test -f "$f" || { echo "BLOCKED: $f missing; [POST-IMPLEMENTATION; CURRENTLY NON-EXISTENT]"; exit 1; }
done

# [POST-IMPLEMENTATION; CURRENTLY NON-EXISTENT]
test -d "${HOME}/.local/state/qoderwork/task-lens/m1-validation/PHASE-06-v2" \
  || { echo "BLOCKED: PHASE-06-v2 evidence root missing"; exit 1; }
bun test scripts/task-lens
TASK_LENS_REAL_TARGETS=1 bun test scripts/task-lens/__tests__/integration.test.ts

# typecheck must exit 0 (v2 strict)
set +e
bun run typecheck > /tmp/typecheck-after-PHASE-06-v2-wsl.txt 2>&1
typecheck_exit=$?
set -e
printf '\nTYPECHECK_EXIT=%s\n' "$typecheck_exit" >> /tmp/typecheck-after-PHASE-06-v2-wsl.txt
test "$typecheck_exit" -eq 0

rg -n '"writeState":"NOT_FOUND"|"writeState": "NOT_FOUND"|"env": "wsl"' "${HOME}/.local/state/qoderwork/task-lens/m1-validation/PHASE-06-v2"

# outcome-governance structural validator (gen2 阶段)
bun run scripts/validate-outcome-governance.ts plans/task-lens-outcome-v1 --repository-root "$(pwd)"
```

> 本轮 plan 不执行；执行前必须 v2 contract human-approved + real-target index up-to-date。

### 11.2 不可执行命令标注

- `bun test scripts/task-lens` 在本轮**部分文件不存在**（`metrics.test.ts`、`cli-integration.test.ts`、`integration.test.ts` 未创建）；标 `[POST-IMPLEMENTATION; CURRENTLY NON-EXISTENT]`。
- `TASK_LENS_REAL_TARGETS=1 bun test scripts/task-lens/__tests__/integration.test.ts` 在本轮 `integration.test.ts` 未创建；标 `[POST-IMPLEMENTATION; CURRENTLY NON-EXISTENT]`。
- `rg` 路径在 Git Bash 端需替换为 `%LOCALAPPDATA%\qoderwork\task-lens\m1-validation\PHASE-06-v2`；不可共用同一路径。
- 禁止 `validate-audit.ts` 任何变体。

## 12. Rollback / failure convergence

1. 本 phase 失败不改生产代码；创建 rework finding 并回到 PHASE-05-v2 新 rework scope-lock；
2. 禁止删除 real-target evidence 或修改目标项目恢复 hash；若 writeState=FOUND，保留现场并停止；
3. 双端任一 FAIL 不得覆盖另一端 PASS；保留双端 evidence。
4. gen2 outcome 文件回滚：仅删除 gen2 文件；不修改 v1 frozen。

## 13. Phase completion gate

- [ ] PHASE-06-v2 双端 Freeze Gate 与全部 caller tests 完整；
- [ ] fixture WT/commit/delete/coverage/safety checks 双端全 PASS；
- [ ] work-one 与 qoderwork-main 各两份 current run receipt（双端各一份）完整；
- [ ] TL-ZERO-WRITE-v2 敏感反例双端均先 FAIL，真实两目标后 PASS；
- [ ] 双端各两份 Human manual card review PASS（reviewer 凭证不共用）；
- [ ] typecheck exit 0（v2 严格），bun.lock 无 diff，allowed-file diff only；
- [ ] 双端 case verdict 独立汇总到单一 canonical outcome-run-result-v2.json；任一 FAIL = 整体 FAIL；
- [ ] PHASE-07-v2 在全部勾选前保持 BLOCKED。