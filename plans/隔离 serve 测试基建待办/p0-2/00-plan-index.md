# P0-2 双 run 确定性隔离 — Plan Index

**Plan mode**: `PLAN_SET`
**ID**: `ISO-SERVE-P0-2-PLANSET-20260719`
**Status**: `READY-FOR-IMPLEMENTATION`
**Only implementation path**: 按 manifest 顺序完成八个单结果 Phase；任一完成门失败即保留证据并阻断依赖 Phase。
**Evidence ceiling**: 当前仅有 verifier component 证据；P0-2 runtime-smoke 为 `NOT-RUN`。

## 1. Input contract and source ledger

| Source | Version/status | Sections used | Authority | Current/historical |
|---|---|---|---|---|
| `blueprints/blueprint-isolated-serve-test-infrastructure.md` | approved | TSI-01–08, §5 | 隔离、双 DB、真实 bootstrap、证据边界 | design |
| `scripts/test-serve/types.ts` | current | `RunPaths`, `P02VerifyInput` | 当前类型与路径字段 | current |
| `scripts/test-serve/verify-p02.ts` | current | 全文 | 当前 verifier 缺口 | current |
| `scripts/test-serve/isolated-serve.ts` | current | command union/help | 当前 CLI 无 `p0-2` | current |
| `logs/2026-07-18-P0-2实施计划审计.md` | historical audit | 全文 | 旧复审结论 | historical |

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

### In scope

- `verify-p02`、P0-2 sentinel/coordinator、CLI、双 run runtime、回归和文档闭环。

### Non-goals

- live LLM E2E、`H2_AUTHORIZED=true`、TSI-05 run-mode、修复范围外 typecheck 债务。
- 裸 `opencode serve`、固定 4097、固定 `/tmp/sse-events.jsonl`、`pkill`、直接写 oracle DB。

### Open/blocking items

- `P0_2_PORT_A/P0_2_PORT_B` 与第二组端口仅由 reviewer 提供；阻断 PHASE-05/06。
- 根 `bun run typecheck` 当前 exit 1；阻断 PHASE-07/08 和 P0-2 DONE。

### Negative evidence semantics

- PASS 仅为 `evidenceReadable && querySucceeded && targetState === NOT_FOUND`。
- `FOUND`、`UNAVAILABLE`、解析失败、缺表和 timeout 均为 FAIL，并写入精确 `failedChecks`。

### Current versus historical evidence

- 44/0/83 仅证明当前组件测试；不证明 P0-2 runtime。
- runtime、cleanup 和 DONE 必须读取本轮 run 的 manifest、stage results、DB、logs、events 与 cleanup report。

## 3. Verified current baseline

| Claim | Status | Evidence/command | Result |
|---|---|---|---|
| verifier component suite | VERIFIED | `bun test oracle verify-p01b verify-p02` | 44 pass / 0 fail / 83 expect |
| current verifier API | VERIFIED | `verify-p02.ts` | 五阶段、布尔 oracle、无依赖注入 |
| P0-2 coordinator files | VERIFIED | `rg --files scripts/test-serve` | 不存在 `p02-sentinel.ts` 或 `p02-orchestrator.ts` |
| P0-2 CLI | VERIFIED | `isolated-serve.ts --help` | 不存在 `p0-2` command |
| root typecheck | VERIFIED | `bun run typecheck` | exit 1，范围外既有错误 |
| P0-2 runtime evidence | VERIFIED | state/evidence 文件枚举 | `NOT-RUN` |

## 4. End-to-end traceability

| Requirement | Source | Phase | File/symbol | Check name | Evidence source | Happy fixture | Single mutation | Test ID | Level |
|---|---|---|---|---|---|---|---|---|---|
| REQ-001 | verifier | PHASE-01 | `verifyP02` | tri-state isolation | A/B/main DB + events | one missing DB/table | P02-V-* | component |
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
| 2 | PHASE-02 | `02-phase-verifier-lifecycle.md` | PHASE-01 | READY |
| 3 | PHASE-03 | `03-phase-sentinel-orchestrator.md` | PHASE-02 | BLOCKED |
| 4 | PHASE-04 | `04-phase-cli.md` | PHASE-03 | BLOCKED |
| 5 | PHASE-05 | `05-phase-runtime-test.md` | PHASE-04 | BLOCKED |
| 6 | PHASE-06 | `06-phase-cli-smoke.md` | PHASE-05 | BLOCKED |
| 7 | PHASE-07 | `07-phase-regression.md` | PHASE-06 | BLOCKED |
| 8 | PHASE-08 | `08-phase-document-closure.md` | PHASE-07 | BLOCKED |
