# P0-2 双 run 确定性隔离 — Plan Index

**Plan mode**: `PLAN_SET`
**ID**: `ISO-SERVE-P0-2-PLANSET-20260719`
**Status**: `IN-PROGRESS`
**Only implementation path**: PHASE-04 Accept（generation 2 重实施审计 2026-07-21；CLI 路由恢复；43 pass / 0 fail；component 级；审计 `audits/p0-2/2026-07-21-phase-04-cli-reimplementation-audit.md`）。PHASE-06a ACCEPT（G2 独立复审 2026-07-21）。PHASE-03 DONE（audit-5 Accept）。PHASE-05 ACCEPT（v3 审计 2026-07-22；runtime-smoke 级；审计 `audits/p0-2/2026-07-22-phase-05-runtime-test-audit-v3.md`）。下一步：PHASE-06 CLI smoke（需重新走 Freeze Gate）。
**Evidence ceiling**: component suite 为 292 pass / 0 component fail / 2 runtime NOT-RUN（2026-07-21 PHASE-04 重实施复验：p02-cli 6 + p01b-orchestrator 37 = 43 pass / 0 fail；完整 suite 292 pass / 2 runtime 前置拒绝）；PHASE-06a `ACCEPT`（G2 独立复审 2026-07-21）；PHASE-04 `Accept`（generation 2 重实施审计 2026-07-21：CLI 路由恢复，日志声明全部可复现；审计 `audits/p0-2/2026-07-21-phase-04-cli-reimplementation-audit.md`）。PHASE-06a 作为前置修复提前执行，不依赖 PHASE-04/05 完成。

**Provenance level**（AGENTS.md §15 规则 P-01 声明）:
- PHASE-01~04: `component-only`（历史 phase，pre-change receipt 不可重建，接受 component 级证据上限；审计报告必须标注「证据上限：component」，禁止签署 v2.1 正式 ACCEPT）
- PHASE-04a, PHASE-05~08: `v2.1-required`（实施前必须完成 Pre-Implementation Freeze Gate：scope-lock 填写 → human approval → `capture-state.ts` 捕获 pre-change receipt → 验证非空；违反则审计判定 INVALID）

## 1. Input contract and source ledger

| Source | Version/status | Sections used | Authority | Current/historical |
|---|---|---|---|---|
| `blueprints/blueprint-isolated-serve-test-infrastructure.md` | approved | TSI-01–08, §5 | 隔离、双 DB、真实 bootstrap、证据边界 | design |
| `scripts/test-serve/types.ts` | current | `RunPaths`, `P02VerifyInput` | 当前类型与路径字段 | current |
| `scripts/test-serve/verify-p02.ts` | current | 全文 | 当前 verifier 缺口 | current |
| `scripts/test-serve/isolated-serve.ts` | current | command union/help | 当前 CLI 无 `p0-2` | current |
| `logs/2026-07-18-P0-2实施计划审计.md` | historical audit | 全文 | 旧复审结论 | historical |
| `logs/2026-07-19-p0-2-phase-01-gate-audit.md` | audit | 全文 | PHASE-01 NO-GO | current |

### Atomic requirements

| ID | Condition | Required behavior | Observable result | Source | Owning Phase |
|---|---|---|---|---|---|
| REQ-001 | 跨 run 负向查询 | 区分 `FOUND/NOT_FOUND/UNAVAILABLE` | `UNAVAILABLE` 不能通过隔离检查 | verifier | PHASE-01 |
| REQ-002 | A 停止和 cleanup | 当前观测 B 与 sentinel | 每个读取失败都有精确 `failedChecks` | verifier | PHASE-02 |
| REQ-003 | 双 run 生命周期 | 固定 16 stage 编排和失败收敛 | 仅本 run PID 可 stop | blueprint | PHASE-03 |
| REQ-004 | CLI 入口 | 单命令调用 coordinator | 参数拒绝时调用次数为 0 | CLI | PHASE-04 |
| REQ-005 | runtime proof | 两组不同端口的真实 run | artifacts 在持久 state root 可读 | blueprint | PHASE-05, PHASE-06 |
| REQ-006 | P0-2 closure | 静态门、证据和文档同步 | 不把低层 PASS 写成 runtime PASS | rules | PHASE-07, PHASE-08 |

## 2. Decisions, scope, and non-goals

### Decision ledger

| ID | Question | Upstream decision | Current-code constraint | Final contract | Status |
|---|---|---|---|---|---|
| DEC-001 | verifier 是否扩张 `oracle.ts` | 否 | oracle 只返回 boolean | 在 `verify-p02.ts` 内建三态只读适配 | closed |
| DEC-002 | P0-2 是否复用 P0-1B CLI | 否 | CLI 仅有 `p0-1b` | 新增 `p0-2`，不改 P0-1B contract | closed |
| DEC-003 | runtime 是否现在执行 | 否 | reviewer 端口未提供 | Phase 05/06 保持 `NOT-RUN` | closed |
| DEC-004 | 根 typecheck 是否阻断 verifier | 否 | 当前根 typecheck 失败于范围外债务 | 仅阻断 PHASE-07/08 closure | closed |
| DEC-005 | 代码与状态范围 | 代码改动可隔离 | log/index 是证据 | 分开验证 | closed |
| DEC-006 | P1 长度 | 19字段/88case | 单一 | 12515/14000 | exception |

### In scope

- `verify-p02`、P0-2 sentinel/coordinator、CLI、双 run runtime、回归和文档闭环。

### Non-goals

- live LLM E2E、`H2_AUTHORIZED=true`、TSI-05 run-mode、修复范围外 typecheck 债务。
- 裸 `opencode serve`、固定 4097、固定 `/tmp/sse-events.jsonl`、`pkill`、直接写 oracle DB。

### Open/blocking items

- ~~PHASE-06a 需完成 Freeze Gate~~ **RESOLVED**（2026-07-21）：Freeze Gate 已完成（scope-lock APPROVED → human approval → pre-change receipt → verdict-state receipt g2），审计 G2 ACCEPT。PHASE-06 CLI smoke 的前置依赖已满足，但仍需 PHASE-04/05 完成后才可执行。
- PHASE-04a（debt phase）：关闭 PHASE-04 审计 F-001（existsSync 简化）。`isolated-serve.ts` absoluteInputs 验证需增加 existsSync 检查；`p02-cli.test.ts` fixture 从 `/fake/*` 改为 `mkdtempSync` 真实路径；新增 P02-C-PATH-EXIST 用例。**v2.1-required provenance**，实施前需完成 Freeze Gate（scope-lock → human approval → pre-change receipt）。Plan 已创建（`04a-phase-existsync-fix.md`），待 Freeze Gate + 实施。
- `P0_2_PORT_A/P0_2_PORT_B` 第一组已提供（4001/4002，PHASE-05 ACCEPT）；第二组端口 4003/4004 由 implementer 使用，需 reviewer 确认。
- 根 `bun run typecheck` 当前 exit 1；阻断 PHASE-07/08 和 P0-2 DONE。

### Negative evidence semantics

- PASS 仅为 `evidenceReadable && querySucceeded && targetState === NOT_FOUND`。
- `FOUND`、`UNAVAILABLE`、解析失败、缺表和 timeout 均为 FAIL，并写入精确 `failedChecks`。

### Current versus historical evidence

- 186/0/4870 证明当前组件测试（含 D1/D2 反例）；D1/D2 独立反例已关闭，仍不证明 P0-2 runtime（runtime `NOT-RUN`）。
- runtime、cleanup 和 DONE 必须读取本轮 run 的 manifest、stage results、DB、logs、events 与 cleanup report。

## 3. Verified current baseline

| Claim | Status | Evidence/command | Result |
|---|---|---|---|
| PHASE-03 component suite | VERIFIED | `bun test verify-p02.test.ts p02-orchestrator.test.ts` | 186 pass / 0 fail / 4870 expect；D1 failure-boundary 与 D2 非 ESRCH 信号 fail-closed 反例已关闭（P02-O-D1-*/P02-O-D2-*），PHASE-03=DONE（audit-5 Accept） |
| current verifier API | VERIFIED | `verify-p02.ts` + gate audit | 三态/表探测/逐行 events/首失败短路已落实；88 case 矩阵 125 pass 0 fail |
| P0-2 coordinator files | VERIFIED | `rg --files scripts/test-serve` | `p02-sentinel.ts` 与 `p02-orchestrator.ts` 已存在（186 pass） |
| P0-2 CLI | VERIFIED | `isolated-serve.ts --help` | 不存在 `p0-2` command |
| P0-2 PHASE-02 component | VERIFIED | `bun test verify-p02.test.ts` | 145 pass / 0 fail；coexistence/after-stop-a/cleanup 均 singleton 测试，含 P02-L-* 矩阵 |
| root typecheck | VERIFIED | `bun run typecheck` | exit 1，范围外既有错误（PHASE-02 不阻断） |
| P0-2 runtime evidence (PHASE-05) | `NOT-FOUND`（2026-07-20 修正） | `find /home/zhaoge/.local/state/qoderwork/test-runs/ -name '*p0-2*'` | 无结果；原声明的 2026-07-20 runtime run 目录不存在；artifacts 丢失 |

> **2026-07-20 基线修正说明**：交叉审核发现 PHASE-04 声明 DONE 与代码现状不符（`isolated-serve.ts` 无 `p0-2` 路由），PHASE-05 声明 runtime 证据在文件系统不存在。本次修正将 PHASE-04 回退为 `PARTIAL`、PHASE-05 回退为 `NOT-RUN`、PHASE-06a Starting state 修正为"p0-2 路由未实现"。PHASE-01~03 代码幸存且 component 测试可复验（199 pass / 0 fail）。

> **2026-07-21 状态同步**：PHASE-06a（cleanup.ts 提取 + 循环依赖打破 + TDZ 预防）经 G2 独立复审判定 ACCEPT（审计 `audits/p0-2/2026-07-21-phase-06a-cleanup-extract-audit-g2.md`，validate-audit valid=true, 0 errors）。PHASE-04 重实施完成（CLI 路由恢复 + `runTestServeCli` 导出），generation 2 审计 Accept（component 级；审计 `audits/p0-2/2026-07-21-phase-04-cli-reimplementation-audit.md`；43 pass / 0 fail；日志声明全部可复现）。下一步：PHASE-05 runtime test（需 reviewer 端口 + v2.1 Freeze Gate）。

> **2026-07-22 状态同步**：PHASE-05（首次真实双 run runtime test）经 v3 审计判定 ACCEPT（v2.1-required；runtime-smoke 级；审计 `audits/p0-2/2026-07-22-phase-05-runtime-test-audit-v3.md`；validate-audit valid=true, 0 errors）。scope-lock v3 human-approved（allowed_files 收窄至 p02-runtime.test.ts）；runtime test 1 pass/0 fail/50 expect()；16 stages ok；A/B CLEANED；3 负控制 SENSITIVE。PHASE-04a F5 独立审计 ACCEPT（component 级）。下一步：PHASE-06 CLI smoke（需重新走 Freeze Gate）。

## 4. End-to-end traceability

| Requirement | Source | Phase | File/symbol | Check name | Evidence source | Happy fixture | Single mutation | Test ID | Level |
|---|---|---|---|---|---|---|---|---|---|
| REQ-001 | verifier | PHASE-01 | `verifyP02` | tri-state isolation | A/B/main DB + events | complete fixture | Phase-01 P02-V ledger | component |
| REQ-002 | verifier | PHASE-02 | `verifyP02` | current lifecycle/cleanup | live-reader dependencies | one current observation false | P02-L-* | component |
| REQ-003 | blueprint | PHASE-03 | `runP02` | stage/firstFailure | 16-stage injected success | one stage throws | P02-O-* | component |
| REQ-004 | CLI | PHASE-04 | `isolated-serve.ts` | CLI JSON contract | valid arguments | one invalid argument | P02-C-* | component |
| REQ-005 | blueprint | PHASE-05/06 | runtime/CLI | persisted dual-run proof | reviewer ports | unavailable port | P02-R-* | runtime-smoke |
| REQ-006 | rules | PHASE-07/08 | gates/docs | closure evidence | all prior artifacts | missing artifact | P02-G-* | manual verification |

## 5. File change inventory

| # | Exact path | Change | Exact symbol/anchor | Reason | Phase |
|---|---|---|---|---|---|
| 1 | `scripts/test-serve/verify-p02.ts` | modify | `verifyP02` | fail-closed verifier | PHASE-01/02 |
| 2 | `scripts/test-serve/types.ts` | modify | P02 types | injected readers and stage results | PHASE-01/03 |
| 3 | `scripts/test-serve/p02-sentinel.ts` | add | module | sentinel identity | PHASE-03 |
| 4 | `scripts/test-serve/p02-orchestrator.ts` | add | `runP02` | lifecycle coordinator | PHASE-03 |
| 5 | `scripts/test-serve/isolated-serve.ts` | modify | command switch | CLI route | PHASE-04 |
| 6 | `scripts/test-serve/__tests__/` | add/modify | P02 tests | component/runtime evidence | PHASE-01–07 |

### Globally forbidden changes

- `oracle.ts` public API、`process.ts`、`run-context.ts`、`bootstrap.ts`、`verify-p01b.ts`，除非本计划某个 Phase 明确把它加入 Allowed files。

## 6. Phase manifest

| Order | Phase ID | File | Depends on | Status |
|---|---|---|---|---|
| 1 | PHASE-01 | `01-phase-verifier-isolation.md` | NONE | DONE |
| 2 | PHASE-02 | `02-phase-verifier-lifecycle.md` | PHASE-01 | DONE |
| 3 | PHASE-03 | `03-phase-sentinel-orchestrator.md` | PHASE-02 | DONE（audit-5 Accept；D1–D4 全部关闭） |
| 4 | PHASE-04 | `04-phase-cli.md` | PHASE-03 | DONE（2026-07-19 实施：CLI 路由 + 6 P02-C 用例 + P0-1B 回归 37 pass，共 43 pass / 0 fail） |
| 4 | PHASE-04 | `04-phase-cli.md` | PHASE-03 | DONE（2026-07-21 重实施：CLI 路由恢复 + 6 P02-C 用例 + P0-1B 回归 37 pass，共 43 pass / 0 fail；generation 2 审计 Accept，component 级；审计 `audits/p0-2/2026-07-21-phase-04-cli-reimplementation-audit.md`） |
| 4.5 | PHASE-04a | `04a-phase-existsync-fix.md` | PHASE-04 | `ACCEPT`（F5 独立审计 2026-07-22：existsSync fix + P02-C-PATH-EXIST 用例；3 REQ 全 PASS；component 级；审计 `audits/p0-2/2026-07-22-phase-04a-existsync-audit-f5.md`；validate-audit valid=true, 0 errors；prepare-audit.ts 生成，structural errors=0） |
| 5 | PHASE-05 | `05-phase-runtime-test.md` | PHASE-04 | `ACCEPT`（v3 审计 2026-07-22：scope-lock v3 human-approved；runtime test 1 pass/0 fail/50 expect()；16 stages ok；A/B CLEANED；3 负控制 SENSITIVE；runtime-smoke 级；审计 `audits/p0-2/2026-07-22-phase-05-runtime-test-audit-v3.md`；validate-audit valid=true, 0 errors） |
| 5.5 | PHASE-06a | `06a-phase-circular-dependency-fix.md` | PHASE-03（前置修复，提前执行） | `ACCEPT`（G2 独立复审 2026-07-21：cleanup.ts 提取 + 循环依赖打破 + TDZ 预防；4 REQ 全 PASS；component 级；审计 `audits/p0-2/2026-07-21-phase-06a-cleanup-extract-audit-g2.md`；validate-audit valid=true, 0 errors） |
| 6 | PHASE-06 | `06-phase-cli-smoke.md` | PHASE-06a | BLOCKED（audit-1 INVALID：Freeze Gate 未完成 + 代码修改违反 plan Forbidden；修复后重新走 Freeze Gate） |
| 7 | PHASE-07 | `07-phase-regression.md` | PHASE-06 | BLOCKED |
| 8 | PHASE-08 | `08-phase-document-closure.md` | PHASE-07 | BLOCKED |
