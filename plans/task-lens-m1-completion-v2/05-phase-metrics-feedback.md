# Phase PHASE-05-v2: Metrics/Feedback 双环境落地（successor）

**Phase ID**: `PHASE-05-v2`
**Depends on**: frozen PHASE-04 ACCEPTED + frozen PHASE-05（NOT_STARTED，本 phase 不修改其本体）+ 双环境 runtime smoke PASS + **v2 plan INDEX DRAFT→READY-FOR-IMPLEMENTATION**
**Outcome**: 在 WSL Ubuntu-24.04 native FS 与 Windows Git Bash 各产生一份 metrics/feedback 端到端行为可核验的 evidence；lock + append + fsync + recovery + summary + CLI 各 check 双端全 PASS；不修改 frozen predecessor；每个 REQ 两个固定 case 汇总到单一 canonical outcome-run-result-v2.json
**Evidence level**: integration（双端各一份）
**Progression status**: `NOT_STARTED`（本轮 plan 不写 DRAFT→READY-FOR-IMPLEMENTATION，等 human approval）

> **重要**：本 phase 文件是 `plans/task-lens-m1-completion-v2/05-phase-metrics-feedback.md`，不是 `plans/task-lens-m1/05-phase-metrics-feedback.md` 的修改或替代品。两份文件并存；predecessor 状态分裂（LATEST ACCEPTED vs plan-index NOT_STARTED vs handoff BLOCKED）**不裁决**（DEC-V2-009），仅作为历史输入；v2 以当前树缺失 + v1 out_of_scope 为新工作起点。

## 1. Goal

- 实现 REQ-011v2 / REQ-012v2；
- 在 WSL Ubuntu-24.04 native FS 与 Windows Git Bash 各采集一份 metrics/feedback 集成级 evidence；
- 显式区分 v1 contract 的"解析契约 component-only"边界，gen2 推到"metrics/feedback integration + 双环境"边界；
- 每个 REQ 有 WSL case + Git Bash case 两个固定 case，汇总到单一 canonical `outcome-run-result-v2.json`（不是 `outcome-run-result.gitbash.json`）。

## 2. Starting state and dependency

- Required status: frozen PHASE-04 ACCEPTED；本文件 predecessor phase file 状态为 NOT_STARTED（frozen；不再裁决）；
- Required evidence（v2 实施阶段采集，本轮不假定存在）：
  - WSL 端：`plans/task-lens-outcome-v1/runs/receipt/case-{REQ-011v2-WSL}.json`
  - Git Bash 端：`plans/task-lens-outcome-v1/runs/receipt/case-{REQ-011v2-GITBASH}.json`
  - 双端 human-approved scope-lock 各一份（本轮 plan 不创建文件；v2 实施阶段创建并落盘到 gen2 evidence root；v2 禁止作为 evidence root 引用 / 不得写入 legacy `audits/**`（DEC-V2-010），evidence-类审计路径由实施阶段另行 amendment 决定）
- If absent: `BLOCKED`，do not continue。

## 3. 双环境 acceptance matrix（本 phase 强制）

| 维度 | WSL Ubuntu-24.04 native FS | Windows Git Bash |
|---|---|---|
| Evidence root | `${HOME}/.local/state/qoderwork/task-lens/m1-validation/PHASE-05-v2` | `%LOCALAPPDATA%\qoderwork\task-lens\m1-validation\PHASE-05-v2` |
| mkdir 路径契约 | `mkdir -p <anchor>` | `mkdir -p "$LOCALAPPDATA/qoderwork/task-lens/m1-validation/PHASE-05-v2"` 或 `mkdir -p "$(cygpath -u "$LOCALAPPDATA")/qoderwork/task-lens/m1-validation/PHASE-05-v2"`；**禁止 PowerShell**（PowerShell 不是 Git Bash 兼容 shell） |
| mkdir lock | 原子创建；fsync 通常成功 | Win32 directory handle；`fsync` 行为不等价；要求 test 仅断言 lock 互斥成功，不断言 fsync 字节语义 |
| Two-process contention | 真实 fork+exec；`pid` 写入 `owner.json`；5s 未获锁失败 | Win32 CreateProcess；`pid` 可写入；不依赖跨域进程探测 |
| JSONL scanner | POSIX newline bytes；UTF-8 | CRLF/LF 混合需显式 normalize；UTF-8 |
| Validator path | POSIX forward-slash | Win32 backslash（validator regex `^runs\/(?:receipt\|env\|out\|err)(?:[-.]\|\/)` 不匹配，bundled evidence 一律 forward-slash 路径） |
| `bun test` exit | 同命令；进程模型差异 | 同 |
| `bun run task-lens generate` exit | 0 success / 2 degraded / 21 conflict / 10 invalid | 同 |
| outcome case | REQ-011v2 WSL case（case_id 含 WSL 后缀） | REQ-011v2 Git Bash case（case_id 含 GITBASH 后缀） |
| Verdict 合并 | run-result-v2.case_results 包含两端 case；任一 FAIL = 整体 FAIL | 同 |

**约束**：两环境各自独立 evidence root + 各自 lock owner.json；任何"WSL PASS"的外推到 Git Bash 必须显式标注 `[UNVERIFIED-CROSS-ENV]`。

## 4. Local requirements

| ID | Condition | Required behavior | Observable result | 双端 case |
|---|---|---|---|---|
| REQ-011v2-A | generate 成功 | artifact commit 后 lock + append + fsync generated | 一行合法 JSON，taskId 唯一 | REQ-011v2-WSL + REQ-011v2-GITBASH |
| REQ-011v2-B | metrics append 中断 | 同 taskId retry 只补缺失 event，不覆盖 artifact | query FOUND 拒绝；NOT_FOUND 可恢复；UNAVAILABLE 失败 | 同上 |
| REQ-011v2-C | feedback | 校验 task/generated、字段和值域、拒绝重复 | 一任务最多一条 feedback | 同上 |
| REQ-011v2-D | concurrent writers | 目录 lock 串行化，5s 未获锁失败 | 行不交错，逐行 JSON.parse | 同上 |
| REQ-011v2-E | summarize | 只读 metrics 并按 taskId join | INCOMPLETE/PASS/FAIL 三态与计数 | 同上 |
| REQ-012v2-A | 负例/诊断 | all-pass 后单 mutation | exact singleton failedChecks | REQ-012v2-WSL + REQ-012v2-GITBASH |
| REQ-012v2-B | CLI wiring | generate 调完整确定性管线 | fixed exit code 与 artifacts/metrics 一致 | 同上 |

## 5. Allowed files（本 phase 实施阶段；本轮 plan 仅声明不修改）

| Exact path | Change | Exact symbol/anchor | 双端 |
|---|---|---|---|
| `plans/task-lens-m1-completion-v2/05-phase-metrics-feedback.md` | add（本轮新建） | 本文件 | n/a |
| `scripts/task-lens/metrics.ts`（future, v2 实施） | add | `appendGenerated`, `appendFeedback`, `summarizeMetrics`, `withMetricsLock` | 两端各一份 |
| `scripts/task-lens/cli.ts`（future, v2 实施） | modify | `main` full pipeline/subcommands | 两端各一份 |
| `scripts/task-lens/artifact-writer.ts`（future, v2 实施） | modify | verified generated-event recovery | 两端各一份 |
| `scripts/task-lens/README.md`（future, v2 实施） | modify | CLI/config/artifact/exit contract | 两端共用 |
| `scripts/task-lens/__tests__/metrics.test.ts`（future, v2 实施） | add | validation/lock/recovery/summary | 两端各跑 |
| `scripts/task-lens/__tests__/cli-integration.test.ts`（future, v2 实施） | add | end-to-end fixture CLI | 两端各跑 |

### 5.1 Frozen caller tests（只读回归，可运行不可修改 — H4）

以下文件已 frozen（来自 `plans/task-lens-outcome-v1/outcome-test-bundle.json` SHA 绑定），v2 phase 实施阶段可运行回归但**不得修改**：

| Frozen file | SHA 绑定 | 角色 |
|---|---|---|
| `scripts/task-lens/__tests__/input-diff.test.ts` | `ed85646005060f082d28f7d4ff043637c0886d184047b83486583382431d6b7e` | caller test for v2 metrics module |
| `scripts/task-lens/__tests__/command-security.test.ts` | `bb058c55736789d1cfff84fb0ef167e7e841132a06fcaa209a54c0ff87d07c74` | caller test |
| `scripts/task-lens/__tests__/provider-graph.test.ts` | `2b6e2f76c98015707842d0d126778405c7b65d3837104f5dbea2e7b72d6ada66` | caller test |
| `scripts/task-lens/__tests__/spine.test.ts` | `ee4b1777894a5cdb8a6a95714d46eaa4bb8280f78ee60428e3b2c2f40c8925ea` | caller test |
| `scripts/task-lens/__tests__/coverage-render.test.ts` | `872248501fcb51d936a623ec5d91a7cd9937fd45fa91a777e987b1055ffb2796` | caller test |
| `scripts/task-lens/__tests__/artifact-writer.test.ts` | `8625f921b3127e323ab3ad2d51c68fb2a3059db2f1a3d1ad16bbe488faf6b268` | caller test |

### 5.2 v2 allowed modified tests（本 phase v2 实施阶段可新增/修改）

- `scripts/task-lens/__tests__/metrics.test.ts`（新增）
- `scripts/task-lens/__tests__/cli-integration.test.ts`（新增）
- 上述 frozen caller tests 的 `import` 语句可能需要新增；**不得修改 frozen 文件本体**（SHA 一旦改变即破坏 v1 outcome test-bundle 绑定）。

### 5.3 Globally forbidden changes

- 任何 frozen predecessor 文件：`scripts/task-lens/types.ts`、`codegraph-provider.ts`、`seed-resolver.ts`、`graph-builder.ts`、`spine.ts`、`coverage-reader.ts`、`card-renderer.ts`、`side-effects.ts`、`config.ts`、`command-runner.ts`、`diff-extractor.ts`、所有 frozen `__tests__/*.test.ts`（见 §5.1）。
- `package.json`、`bun.lock`、`scripts/lib/workspace-paths.ts`、`scripts/_b1_live.ts`、`tsconfig.json`。
- `blueprints/INDEX.md`、`documents/INDEX.md`、`plans/task-lens-m1/**`、`plans/task-lens-outcome-v1/**`、`audits/**`。
- 任何 `validate-audit.ts` 变体与 P-01..P-07 v2.1 audit 模板引用。

## 6. Fixed contract（v2 沿用 v1 frozen API，新增双环境标识）

### 6.1 API/signature

```ts
appendGenerated(out: string, event: GeneratedEvent): Promise<void>
appendFeedback(out: string, event: FeedbackEvent): Promise<void>
summarizeMetrics(out: string): Promise<MetricsSummary>
withMetricsLock<T>(out: string, operation: () => Promise<T>): Promise<T>
```

- `out` 是 evidence root（双环境各自 anchor 解析后传入）；
- 函数返回 Promise；reject 必须含 code (`exit21` / `exit10`)；
- 不接受回调式 fsync 关闭（避免隐式 silent close）。

- `GeneratedEvent` 沿用 v1 frozen schema：`taskId`、计数/coverage、truncation、exitCode 与三 artifact SHA；字段和值域按 REQ-011v2-A/C 校验。
```

- `FeedbackEvent` 沿用 v1 frozen schema：`taskId`、useful/loadReduced、issues 计数、reviewMinutes 与 notes；字段和值域按 REQ-011v2-C 校验。
```

- `MetricsSummary` 沿用 v1 frozen schema：generated/feedback/usefulAndReduced 计数、missing/duplicate/invalid 列表与 `INCOMPLETE|PASS|FAIL` gate。
```

### 6.5 Lock 协议（双环境语义一致 + 字节差异说明）

- lock dir = `out + "/.task-lens-metrics.lock"`；
- `mkdir` 原子获取（WSL ✅ POSIX atomic；Git Bash ✅ Win32 `CreateDirectory` atomic，两端均断言行为：第二次 mkdir 必须 EEXIST）；
- `owner.json = {pid, createdAt, taskId, event, env: "wsl"|"gitbash"}`；fsync（WSL: fsync 成功；Git Bash: fsync 行为依赖 OS，不断言字节）；
- 50ms interval、总 5000ms；超时 `exit 21`；
- 禁止 PID 猜测、stale lock 自动删除；仅 owner 正常 `finally` 删除自己创建的 lock dir；
- `env` 字段由 caller 注入；禁止 CLI 自动探测（避免环境歧义）。

### 6.6 Generated recovery（双环境同语义）

1. final task dir `FOUND` 时只读三 artifact，验证 schema/taskId/hash/card headings；
2. metrics query 必须 readable + parse + success；
3. generated `FOUND` → `exit21` conflict；`UNAVAILABLE` → `exit21`；`NOT_FOUND` → 从 artifacts 重建 exact GeneratedEvent 并 append；
4. 不修改/重写 final artifact；feedback 不可由 recovery 生成。

### 6.7 Feedback（双环境同语义）

- task dir 与 generated 必须 FOUND；
- feedback NOT_FOUND 才 append；
- 缺 task/generated 或 duplicate 为 `exit 10`；
- metrics unavailable 为 `exit 21`。

### 6.8 CLI（双环境同语法）

```bash
bun run task-lens [generate] --project ABS --mode working-tree|commit --out ABS [--base SHA] [--config FILE] [--coverage LCOV] [--entry FILE#NAME]
bun run task-lens feedback --out ABS --task-id ID --useful yes|no --load-reduced yes|no --issues-found N --issues-guided-by-card N --review-minutes N [--notes TEXT]
bun run task-lens metrics summarize --out ABS [--json]
```

### 6.9 Exit precedence（双环境同）

- `21 > 20 > 12 > 10 > 13 > 2 > 1`
- generate success = 0；degraded = 2；summary INCOMPLETE = 2；FAIL = 1；PASS = 0；UNAVAILABLE = 21。

### 6.10 v2 新增双环境 evidence 标识（gen2 bundle 内体现）

- evidence root 内每 receipt 必须含 `environment: "wsl"|"gitbash"`；
- 每 REQ 两个固定 case（WSL case + GitBash case），每个 case_id 唯一；
- bundle 同时冻结双端 runner/oracle 元数据（环境、bun 版本、validator 调用参数）；
```

## 8. Check Registry

| Check name | Source of truth | Read/operation | PASS | Missing/corrupt behavior | Exact failure result | 双端 case 映射 |
|---|---|---|---|---|---|---|
| TL-LOCK-v2 | lock dir | two-process attempt (双端各) | serial + owner cleanup | stale/timeout FAIL | `["TL-LOCK-v2"]` | REQ-011v2-{WSL,GITBASH} |
| TL-JSONL-v2 | metrics file | full line parse (双端各) | every line valid | bad/truncated UNAVAILABLE | `["TL-JSONL-v2"]` | 同上 |
| TL-GENERATED-v2 | artifacts+metrics | hash/join (双端各) | one exact event | missing append FAIL | `["TL-GENERATED-v2"]` | 同上 |
| TL-RECOVERY-v2 | existing task | three-state lookup (双端各) | only NOT_FOUND repairs | FOUND/UNAVAILABLE reject | `["TL-RECOVERY-v2"]` | 同上 |
| TL-FEEDBACK-v2 | task+event | validate/join (双端各) | one valid feedback | missing/duplicate FAIL | `["TL-FEEDBACK-v2"]` | 同上 |
| TL-SUMMARY-v2 | JSONL | aggregate (双端各) | exact counts/gate | invalid UNAVAILABLE | `["TL-SUMMARY-v2"]` | 同上 |
| TL-CLI-FLOW-v2 | subprocess | generate→feedback→summary (双端各) | exits/artifacts 一致 | missing FAIL | `["TL-CLI-FLOW-v2"]` | 同上 |
| TL-NEGATIVE-v2 | test registry | singleton assertions (双端各) | exact one failure | coupled FAIL | `["TL-NEGATIVE-v2"]` | REQ-012v2-{WSL,GITBASH} |
| TL-TSC-DELTA-v2 | tsc | baseline diff (双端各) | exit 0（v2 严格，不容忍 exit=1） | exit≠0 FAIL | `["TL-TSC-DELTA-v2"]` | n/a |

## 10. Single-failure Matrix

| Test ID | Baseline | Only mutation | Expected check | Exact failedChecks/error | 双端 |
|---|---|---|---|---|---|
| TL-C-401-v2-WSL | valid pair | truncate last JSON line | TL-JSONL-v2 | singleton/UNAVAILABLE | WSL |
| TL-C-401-v2-GITBASH | valid pair | truncate last JSON line | TL-JSONL-v2 | singleton/UNAVAILABLE | Git Bash |
| TL-C-402-v2-WSL | free lock | precreate lock dir | TL-LOCK-v2 | singleton/exit21 | WSL |
| TL-C-402-v2-GITBASH | free lock | precreate lock dir | TL-LOCK-v2 | singleton/exit21 | Git Bash |
| TL-C-403-v2-{WSL,GITBASH} | complete task, no event | alter artifact hash | TL-RECOVERY-v2 | singleton/exit21 | both |
| TL-C-404-v2-{WSL,GITBASH} | valid feedback | guided=found+1 | TL-FEEDBACK-v2 | singleton/exit10 | both |
| TL-C-405-v2-{WSL,GITBASH} | one feedback | append duplicate taskId | TL-FEEDBACK-v2 | singleton/exit10 | both |
| TL-C-406-v2-{WSL,GITBASH} | 10 pairs/7 yes | change one useful to no | TL-SUMMARY-v2 | gate FAIL | both |
| TL-C-407-v2-WSL | generated flow | inject append EACCES | TL-GENERATED-v2 | exit21/artifact retained | WSL only（Git Bash EACCES 语义不等价，本端可标 N/A-EXPLAINED） |
| TL-C-408-v2-{WSL,GITBASH} | valid CLI | remove generated before feedback | TL-CLI-FLOW-v2 | exit10 | both |
| TL-C-409-v2-{WSL,GITBASH} | dual case per REQ | inject one FAIL case | TL-DUAL-CASE-v2 | 整体 FAIL（不允许单端 PASS） | cross-env |

## 11. Fixed verification（本 phase）— 命令路径可执行性预检

### 11.1 命令清单（含 preflight `[POST-IMPLEMENTATION; CURRENTLY NON-EXISTENT]` 标注）

```bash
# WSL Ubuntu-24.04 native FS（POSIX）

# preflight: confirm files exist or are flagged non-existent
for f in .agents/skills/deterministic-implementation-planning/scripts/validate-plan.ts \
         scripts/validate-outcome-governance.ts \
         scripts/task-lens/__tests__/metrics.test.ts \
         scripts/task-lens/__tests__/cli-integration.test.ts \
         scripts/task-lens/__tests__/artifact-writer.test.ts \
         scripts/task-lens/__tests__/input-diff.test.ts \
         scripts/task-lens/__tests__/command-security.test.ts \
         plans/task-lens-outcome-v1/outcome-contract.json \
         plans/task-lens-outcome-v1/acceptance-spec.json \
         plans/task-lens-outcome-v1/outcome-test-bundle.json \
         plans/task-lens-outcome-v1/outcome-approval.json \
         plans/task-lens-outcome-v1/ledger/event-001-contract-approved.json \
         plans/task-lens-outcome-v1/ledger/event-002-run-recorded.json \
         plans/task-lens-outcome-v1/runs/outcome-run-result.json ; do
  test -f "$f" || { echo "BLOCKED: $f missing; [POST-IMPLEMENTATION; CURRENTLY NON-EXISTENT]"; exit 1; }
done

# [POST-IMPLEMENTATION; CURRENTLY NON-EXISTENT]
bun test scripts/task-lens/__tests__/metrics.test.ts scripts/task-lens/__tests__/cli-integration.test.ts scripts/task-lens/__tests__/artifact-writer.test.ts scripts/task-lens/__tests__/input-diff.test.ts scripts/task-lens/__tests__/command-security.test.ts

# typecheck must exit 0 (v2 strict; predecessor exit=1 tolerance removed)
set +e
bun run typecheck > /tmp/typecheck-after-PHASE-05-v2-wsl.txt 2>&1
typecheck_exit=$?
set -e
printf '\nTYPECHECK_EXIT=%s\n' "$typecheck_exit" >> /tmp/typecheck-after-PHASE-05-v2-wsl.txt
# v2: exit 0 is required; non-zero is FAIL (DEC-V2-006)
test "$typecheck_exit" -eq 0

# outcome-governance structural validator (gen2 阶段)
bun run scripts/validate-outcome-governance.ts plans/task-lens-outcome-v1 --repository-root "$(pwd)"
```

- 禁止使用 `bun run .agents/skills/plan-audit-archiver/scripts/validate-audit.ts` 任何变体。

## 12. Rollback / failure convergence

1. 仅撤销 v2 allowed-files 清单内的文件；保留 metrics/artifact failure fixture。
2. 锁残留时标 BLOCKED 并报告 owner；禁止 agent 自动删锁或 truncate metrics。
3. 双端任一 FAIL 不得用另一端 PASS 覆盖；保留两端 evidence。
4. v2 不修改 frozen predecessor；冲突时停止并报告。
5. gen2 outcome 文件回滚：仅删除 gen2 文件（contract-v2/spec-v2/bundle-v2/amendment-v2/approval-v2/ledger event-003+004/runs/outcome-run-result-v2）；不修改 v1 frozen 文件。

## 13. Phase completion gate

- [ ] PHASE-05-v2 双端 Freeze Gate 与 caller tests 完整；
- [x] lock/JSONL/generated/recovery/feedback/summary/CLI/dual-case checks 双端全 PASS；
- [x] WSL 端两独立 Bun subprocess 真实竞争；Git Bash 端 lock 互斥行为 PASS；
- [x] 坏 JSONL 与 duplicate 均 fail-closed；
- [x] 每个 check 有 all-pass + single mutation，failedChecks 精确 singleton；
- [x] typecheck exit 0（v2 严格），bun.lock 无 diff，allowed-file diff only；
- [x] 双端 evidence 各落盘到独立 root，verdict 不合并；
- [x] gen2 outcome bundle 冻结双端 runner/oracle 元数据（v2 实施阶段）；
- [x] PHASE-06-v2 在全部勾选前保持 BLOCKED。
