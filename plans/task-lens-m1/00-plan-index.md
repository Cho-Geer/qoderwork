# Task Lens M1 确定性实施计划 — Plan Index

**Plan mode**: `PLAN_SET`
**ID**: `TASK-LENS-M1-PLANSET-20260723`
**Status**:`READY-FOR-IMPLEMENTATION`
**Only implementation path**: 按 PHASE-01 至 PHASE-07 顺序；gate 失败即停止。
**Evidence ceiling**: `NOT-RUN`
**Provenance level**: `v2.1-required`

## 1. Input contract and source ledger

| Source | Version/status | Sections used | Authority | Current/historical |
|---|---|---|---|---|
| `blueprints/blueprint-task-lens-m1.md` | v0.1.5 | §〇、§2.4、§3-§6 | requirements | current |
| `handoff/task-lens-resume.md` | 2026-07-23 | Q1-Q8、§6-§8 | decisions | current |
| `logs/2026-07-23-task-lens-blueprint.md` | 2026-07-23 | 全文 | evidence | historical |
| `package.json`、`tsconfig.json` | worktree | scripts/include | build | current |
| `work-one/.codegraph/codegraph.db` | schema8/extract24 | core tables | provider | current |
| 用户决议 2026-07-23 | confirmed | M1 单卡 | decision | current |

### Atomic requirements

| ID | Condition | Required behavior | Observable result | Source | Owning Phase |
|---|---|---|---|---|---|
| REQ-001 | 任一代码 Phase 开始前 | human-approved scope-lock + pre-change receipt | receipt 非空、可解析、绑定 Phase/HEAD | AGENTS P-02 | PHASE-01 |
| REQ-002 | `working-tree`/`commit` 输入 | 固定快照、纳入 untracked、保留 rename/delete | hunks/DeletedRegion 可复现 | BP §2.4.2 | PHASE-02 |
| REQ-003 | 命令/CLI/config/path 输入 | 固定 argv/env/资源/YAML/realpath 合同 | 注入、越界、超时、超限 exit 10/20 | BP §2.4.1/9 | PHASE-02 |
| REQ-004 | 接受生成输入 | receipt 版本化；canonical hash 得 taskId | 核心 JSON 同输入同 hash | BP §2.4.6/8 | PHASE-02 |
| REQ-005 | provider 启动 | DB capability probe；不足走 CLI fallback | 双路不可用 exit 12 | BP §2.4.2 | PHASE-03 |
| REQ-006 | 解析 seeds/edges | hunk∩range、calls-only、保留边元数据 | 无伪 seed；低置信度标注 | BP §2.4.2/3 | PHASE-03 |
| REQ-007 | 构图/展示 | 搜索 200/500/50；单卡≤20 | 超限列 truncation/uncovered、exit 2 | BP §2.4.3/4+用户 | PHASE-03 |
| REQ-008 | 读取 lcov | FN/FNDA 或 DA∩range 三态 | 失配/缺失为 unknown、exit 2 | BP §2.4.5 | PHASE-04 |
| REQ-009 | 卡片/副作用 | 固定五节；仅 literal heuristic | 声明/观测分列 | BP §2.4.6 | PHASE-04 |
| REQ-010 | 写 artifact | canonical sort、temp+rename、拒绝覆盖 | 完整性失败 exit 21、无 metrics | BP §2.4.6/7 | PHASE-04 |
| REQ-011 | metrics/feedback | lock+append+fsync；关系校验 | JSONL 可解析且绑定 taskId | BP §2.4.6 | PHASE-05 |
| REQ-012 | 组件负例 | all-pass 后每次只变异一项 | 精确单一诊断、零新增 TS error | BP §4.1/4.4 | PHASE-05 |
| REQ-013 | 集成/目标只读 | fixture+两个已索引项目出卡 | exit/artifact 正确且 tracked 零写 | BP §4.2/3 | PHASE-06 |
| REQ-014 | 10-task/关闭 | 10 feedback、≥7/10 双 yes、有效审计 | summary+validate-audit 关闭 M1 | BP §〇/§6 | PHASE-07 |

## 2. Decisions, scope, and non-goals

### Decision ledger

| ID | Question | Upstream decision | Current-code constraint | Final contract | Status |
|---|---|---|---|---|---|
| DEC-001 | 路线/归属 | Option B/A/qoderwork | 无实现 | 本仓零 LLM | CLOSED |
| DEC-002 | 输入/provider | 两 mode；DB+CLI | schema8 | capability 驱动 | CLOSED |
| DEC-003 | coverage/output | lcov；外部 out | Bun1.3.14 | 三态/拒覆盖 | CLOSED |
| DEC-004 | 多卡 | M1 单卡 | 单 spine/card | >20 uncovered/exit2 | CLOSED |
| DEC-005 | typecheck | 登记基线 | TS2307 | 中间零新增；最终0 | CLOSED |
| DEC-006 | provenance | v2.1-required | 工具存在 | 每 Phase Freeze | CLOSED |

### In scope

- `package.json`、新建 `scripts/task-lens/**`、M1 evidence/audit/status。

### Non-goals

- M1.5/M2/M3、多卡、work-one 写入、`bun.lock`、新增依赖、服务。
- 不修 `_b1_live.ts` TS2307；其所有者须在最终关闭前清零。

### Open/blocking items

- `BASELINE-TS-001`: `_b1_live.ts` TS2307；中间禁新增，PHASE-07 前须 exit 0。
- PHASE-02~06 scope-lock 由 Human reviewer 批准；agent 不得自批准。

### Negative evidence semantics

- `FOUND / NOT_FOUND / UNAVAILABLE`；仅 readable+query success+`NOT_FOUND` 为 negative PASS。

### Current versus historical evidence

- 历史结果只证过去；当前 claim 必须用 HEAD-bound receipt/新观察。

## 3. Verified current baseline

| Claim | Status | Evidence/command | Result |
|---|---|---|---|
| task-lens 源码/计划 | VERIFIED | `test -e scripts/task-lens; test -e plans/task-lens-m1` | 源码不存在；本 PLAN_SET 新建 |
| package script | VERIFIED | `rg '"task-lens"\\s*:' package.json` | NOT_FOUND |
| Bun/YAML | VERIFIED | `bun --version`; `Bun.YAML.parse` probe | 1.3.14；可解析 |
| work-one CodeGraph | VERIFIED | `codegraph status` + readonly SQLite | up-to-date；schema v8；extract 24 |
| 本 worktree CodeGraph | CONFLICT | `codegraph status` | 索引属于主 worktree；共享函数用 `rg` fallback 并记录 |
| root typecheck | CONFLICT | `bun run typecheck` | 既有单项 TS2307，BASELINE-TS-001 |
| dirty worktree | VERIFIED | `git status --short` | 用户变更须保留 |

## 4. End-to-end traceability

| Requirement | Phase | File/symbol | Check name | Evidence source | Happy fixture | Single mutation | Test ID | Level |
|---|---|---|---|---|---|---|---|---|
| REQ-001 | 01 | scope-lock/receipt | TL-FREEZE | JSON receipt | approved lock | missing approval | TL-P-001 | manual |
| REQ-002 | 02 | `extractDiff` | TL-DIFF | test output | mixed repo | pure delete/untracked | TL-C-101 | component |
| REQ-003 | 02 | command/config/CLI | TL-INPUT-SAFE | tests | safe argv/out | injection/symlink | TL-C-102 | component |
| REQ-004 | 02 | receipt/taskId | TL-RECEIPT | hashes | canonical input | clock changes | TL-C-103 | component |
| REQ-005 | 03 | provider | TL-PROVIDER | test/DB | schema v8 | column+CLI fail | TL-C-201 | component |
| REQ-006 | 03 | seed/edge | TL-EDGE | tests | calls graph | reference edge | TL-C-202 | component |
| REQ-007 | 03 | spine | TL-BUDGET | JSON | 20 nodes | node 21 | TL-C-203 | component |
| REQ-008 | 04 | coverage | TL-COVERAGE | lcov | aligned DA/FN | hash mismatch | TL-C-301 | component |
| REQ-009 | 04 | card/effects | TL-CARD | snapshot | five sections | missing label | TL-C-302 | component |
| REQ-010 | 04 | artifact | TL-ARTIFACT | files | fresh taskId | existing/rename fail | TL-C-303 | component |
| REQ-011 | 05 | metrics | TL-METRICS | JSONL | generated+feedback | invalid/concurrent | TL-C-401 | component |
| REQ-012 | 05 | registry | TL-NEGATIVE | diagnostics | all-pass | one mutation | TL-C-402 | component |
| REQ-013 | 06 | integration/targets | TL-INTEGRATION | artifacts/status | fixtures+2 repos | local out | TL-I-501 | integration |
| REQ-014 | 07 | summary/audit | TL-CLOSE | metrics/EV | 10 tasks | missing receipt | TL-M-601 | manual |

## 5. File change inventory

| Phase | Exact paths | Change |
|---|---|---|
| 02 | `package.json`; `scripts/task-lens/types.ts`; `cli.ts`; `command-runner.ts`; `config.ts`; `diff-extractor.ts`; `__tests__/input-diff.test.ts`; `__tests__/command-security.test.ts` | entry/contracts/input |
| 03 | `scripts/task-lens/codegraph-provider.ts`; `seed-resolver.ts`; `graph-builder.ts`; `spine.ts`; `presets/work-one.yaml`; `__tests__/provider-graph.test.ts`; `__tests__/spine.test.ts` | structure |
| 04 | `scripts/task-lens/coverage-reader.ts`; `side-effects.ts`; `card-renderer.ts`; `artifact-writer.ts`; `__tests__/coverage-render.test.ts`; `__tests__/artifact-writer.test.ts` | card/artifact |
| 05 | `scripts/task-lens/metrics.ts`; `cli.ts`; `artifact-writer.ts`; `README.md`; `__tests__/metrics.test.ts`; `__tests__/cli-integration.test.ts` | feedback |
| 06 | `scripts/task-lens/__tests__/integration.test.ts`; `README.md` | integration |
| 07 | `blueprints/blueprint-task-lens-m1.md`; `documents/INDEX.md`; `logs/2026-07-23-task-lens-m1-implementation.md`; `logs/INDEX.md` | closure |

### Globally forbidden changes

- `bun.lock`、work-one、现有 `_b1_live.ts`、`.codegraph` DB、M1.5/M2/M3 行为。
- 弱化测试、把 `UNAVAILABLE` 当 absence、将 component 提升为 integration、覆盖既有 taskId。

## 6. Phase manifest

| Order | Phase ID | File | Depends on | Status |
|---:|---|---|---|---|
| 1 | PHASE-01 | `01-phase-freeze-gate.md` | NONE | READY |
| 2 | PHASE-02 | `02-phase-input-safety-diff.md` | PHASE-01 | BLOCKED |
| 3 | PHASE-03 | `03-phase-provider-graph-spine.md` | PHASE-02 | BLOCKED |
| 4 | PHASE-04 | `04-phase-coverage-card-artifact.md` | PHASE-03 | BLOCKED |
| 5 | PHASE-05 | `05-phase-metrics-feedback.md` | PHASE-04 | BLOCKED |
| 6 | PHASE-06 | `06-phase-integration-zero-write.md` | PHASE-05 | BLOCKED |
| 7 | PHASE-07 | `07-phase-acceptance-closure.md` | PHASE-06 | BLOCKED |
