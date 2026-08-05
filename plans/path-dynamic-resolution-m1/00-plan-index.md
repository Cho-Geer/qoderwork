# 路径动态化与跨平台配置收敛 M1 — Plan Index

**Plan mode**: `PLAN_SET`
**Schema version**: `audit-plan-set/v3`
**Document kind**: `plan-set-index`
**ID**: `PATH-DYNAMIC-RESOLUTION-M1-20260725`
**Status**: `SUPERSEDED_BY_OUTCOME_GOVERNANCE_V1` (was `COMPLETE` on 2026-07-29)
**Superseded at**: `2026-08-03`
**Superseded by**: `plans/path-dynamic-resolution-outcome-v1/outcome-contract.json` (schema `outcome-governance/v1`, generation=1)
**Progression schema**: `phase-progression/v1`
**Provenance level**: `v3-required`
**Canonical contract**: `plans/path-dynamic-resolution-m1/canonical-requirements-contract.yaml`
**Canonical contract SHA-256**: `0c939357355936ef329b907e75339c38a119791b6dba6fcade5c3e86df2961f2`
**Approval decision**: `audits/path-dynamic-resolution-m1/approval-decision.json`
**Approval decision SHA-256**: `3c5d1402f0ccc61d58a305974ea7ec93eb3b025331636c255fc38bdd9f055f77`
**Approval decision approved_by**: `ChoGeer`
**Approval decision approved_at**: `2026-07-29T03:55:00Z`
**Scope lock (PHASE-02)**: `audits/path-dynamic-resolution-m1/scope-lock-PHASE-02.json`
**Scope lock SHA-256**: `b2dbb1eeacabf726c16cbaddbd1ac7e2bc52ee14650698266e82cb39a86d112b`
**Pre-change receipt (PHASE-02)**: `audits/path-dynamic-resolution-m1/evidence/pre-change-PHASE-02.json`
**Pre-change receipt SHA-256**: `2a8cf2247ca312e57d9b3c77c06e7012f4087ddb1fbee10725eac34529298609`
**Pre-change work-one HEAD**: `64df828d56611ac121baccfaf666f147980aec85` (clean, 0 status_entries)
**Path-scan**: `audits/path-dynamic-resolution-m1/evidence/path-scan.jsonl` (SHA-256 `a8e55e23adfcfff890db7fb7328225a14421d13a07c8915ebbff961a24286c75`)
**Path-inventory**: `audits/path-dynamic-resolution-m1/evidence/path-inventory.json` (SHA-256 `cf17adbd36369e6d760690345254db018c34daf6e79dd33c432b0e241c136c3e`, `failedChecks: []`, 2504 unique entries)
**PHASE-01 PDR-SCAN/HISTORY/CLASS/LOCK/RECEIPT**: all PASS (executed 2026-07-29)
**PHASE-01 progression status**: `ACCEPTED` (evidence ceiling: component-of-manual; PDR-SCAN/HISTORY/CLASS/LOCK/RECEIPT all green; failedChecks empty)
**PHASE-02 progression status**: `READY_FOR_HUMAN_APPROVAL` — scope-lock APPROVED by ChoGeer 2026-07-29, pre-change receipt captured against work-one HEAD 64df828
**Only implementation path**: 冻结范围 → 解析器 → test-serve；未登记路径只可进入后续已批准计划。
**Evidence ceiling**: `NOT-RUN`

## 1. Input contract and source ledger

| Source | Version/status | Sections used | Authority | Current/historical |
|---|---|---|---|---|
| `blueprint-dynamic-path-resolution.md` | v1.1.0 | §1–§4 | requirements | current |
| `AGENTS.md` | 2026-07-25 | §4/8/9/11/15 | safety | current |
| `provenance-rules.md` | P-01–P-07 | P-01/02/02A/07 | provenance | current |
| inspection | 2026-07-25 | graph/source/Git/Bun | baseline | historical |
| recheck | 2026-07-26 | source/Git/Bun/validator | baseline | current |

### Atomic requirements

| ID | Condition | Required behavior | Observable result | Source | Owning Phase |
|---|---|---|---|---|---|
| REQ-001 | code write | lock + receipt first | bound receipt | P-02 | PHASE-01 |
| REQ-002 | resolve | validated roots/tools | cases pass | BP §2.2 | PHASE-02 |
| REQ-003 | test-serve | roots + file URL | regressions pass | BP §1/3 | PHASE-03 |
| REQ-004 | verify | retain level labels | evidence | BP §4 | PHASE-04 |
| REQ-005 | external path | no unapproved edit | deferred row | BP §3/5 | PHASE-04 |

## 2. Decisions, scope, and non-goals

### Decision ledger

| ID | Question | Upstream decision | Current-code constraint | Final contract | Status |
|---|---|---|---|---|---|
| DEC-001 | route | resolver + JSON | fixed roots | resolver/test-serve M1 | CLOSED |
| DEC-002 | precedence | CLI/env/JSON/fallback | flags exist | flags win | CLOSED |
| DEC-003 | SSE | module asset | fixed path | no isolated root | CLOSED |
| DEC-004 | scan | disposition per match | history/live mix | inventory gate | CLOSED |
| DEC-005 | anchor | work-one | status empty | absolute root | CLOSED |

### In scope

- Phase-02 resolver/example/ignore/start-serve paths.
- Phase-03 test-serve root/SSE/import/caller paths.
- receipts, audit/register, indexes, and log.

### Non-goals

- work-one, IDE machine config, pre-M1 history, evidence, prior logs.
- bulk replacement, bare serve, port `4097`, live-E2E, reviewer variables, upgrades, `bun.lock`.
- unsupported IDE/Windows behavior and deferred batches.

### Open/blocking items

- `CONTINUATION-001`: external entries require an approved successor PLAN_SET; stop after PHASE-04.

### Negative evidence semantics

- `FOUND`: the requested readable object exists and query succeeds.
- `NOT_FOUND`: the requested readable object is absent after a successful query.
- `UNAVAILABLE`: read, parse, query, or identity validation failed. `UNAVAILABLE` is FAIL, never absence PASS.

### Current versus historical evidence

- Historical blueprint scans explain the design boundary only.
- Every implementation claim requires a new command, retained artifact, and phase-bound receipt.

## 3. Verified current baseline

| Claim | Status | Evidence/command | Result |
|---|---|---|---|
| CodeGraph | VERIFIED | `codegraph status/explore/callers` | current worktree index is up to date; primary root has two function callers and SSE path one |
| path scan | VERIFIED | `rg --hidden -n/-l -F '/home/zhaoge/'` | 1,805 matches in 467 files; Phase 01 must classify the drift |
| primary | VERIFIED | source | fixed work-one path |
| SSE | VERIFIED | source | fixed qoderwork path |
| bootstrap | VERIFIED | `bun test scripts/test-serve/__tests__/bootstrap-import-source.test.ts` | 2 pass/component |
| IDE config | VERIFIED | ls-files | four tracked |
| local ignore | VERIFIED | check-ignore | NOT_FOUND |
| work-one | VERIFIED | Git status | empty |
| Phase 02 admission | READY | `validate-phase-progression.ts … PHASE-02` | PHASE-01 ACCEPTED 2026-07-29 (PDR-SCAN/HISTORY/CLASS/LOCK/RECEIPT all PASS, failedChecks empty); validator exit depends on PHASE-01 audit ACCEPT verdict |
| Phase 02 resolver/tests | NOT_FOUND | target paths and fixed test command | resolver and both target tests are absent; no Phase 02 component result — these are produced in PHASE-02 implementation |

## 4. End-to-end traceability

| Requirement | Phase | File/symbol | Check name | Evidence source | Happy fixture | Single mutation | Test ID | Level |
|---|---|---|---|---|---|---|---|---|
| REQ-001 | 01 | locks | PDR-FREEZE | receipt | lock | no approval | PDR-M-001 | manual |
| REQ-002 | 02 | resolver | PDR-RESOLVE | test | JSON | relative | PDR-C-101 | component |
| REQ-002 | 02 | tools | PDR-TOOL | test | exec path | bad path | PDR-C-102 | component |
| REQ-003 | 03 | root | PDR-PRIMARY | test | explicit | malformed | PDR-C-201 | component |
| REQ-003 | 03 | SSE/import | PDR-SSE-IMPORT | test | module | wrong root | PDR-C-202 | component |
| REQ-004 | 04 | run | PDR-RUNTIME | manifest | plan mode | absent | PDR-R-301 | runtime-smoke |
| REQ-005 | 04 | register | PDR-HANDOFF | JSON | deferred | no label | PDR-M-302 | manual |

## 5. File change inventory

| Phase | Exact paths | Change |
|---|---|---|
| 01 | `audits/path-dynamic-resolution-m1/scope-lock-PHASE-02.json`; `audits/path-dynamic-resolution-m1/evidence/pre-change-PHASE-02.json`; `audits/path-dynamic-resolution-m1/evidence/path-scan.jsonl`; `audits/path-dynamic-resolution-m1/evidence/path-inventory.json` | freeze and inventory evidence |
| 02 | `scripts/lib/workspace-paths.ts`; `scripts/lib/__tests__/workspace-paths.test.ts`; `scripts/local-paths.example.json`; `.gitignore`; `scripts/start-serve.ts`; `scripts/__tests__/start-serve-paths.test.ts` | validated resolver and launcher adoption |
| 03 | `scripts/test-serve/run-context.ts`; `scripts/test-serve/__tests__/run-context.test.ts`; `scripts/test-serve/process.ts`; `scripts/test-serve/__tests__/process.test.ts`; `scripts/test-serve/bootstrap.ts`; `scripts/test-serve/__tests__/bootstrap-import-source.test.ts`; `scripts/test-serve/isolated-serve.ts`; `scripts/test-serve/__tests__/isolated-serve-paths.test.ts` | test-serve root and import migration |
| 04 | `audits/path-dynamic-resolution-m1/continuation-register.json`; `audits/path-dynamic-resolution-m1/phase-04-audit.md`; `documents/INDEX.md`; `logs/2026-07-25-dynamic-path-m1-implementation.md`; `logs/INDEX.md` | evidence handoff and activity records |

### Globally forbidden changes

- `.codebuddy/settings.json`, `.codebuddy/settings.local.json`, `.kimi-code/mcp.json`, `.qoder/settings.local.json`, work-one, `bun.lock`, historical evidence directories, and reviewer authorization settings.
- Any dynamic import that accepts a raw platform path instead of `pathToFileURL(...).href`.
- Any Phase advance lacking an `ACCEPTED` dependency, receipt, and checked completion gate.

## 6. Phase manifest

| Order | Phase ID | File | Depends on | Status |
|---:|---|---|---|---|
| 1 | PHASE-01 | `01-phase-freeze-inventory.md` | NONE | ACCEPTED |
| 2 | PHASE-02 | `02-phase-workspace-resolver.md` | PHASE-01 | ACCEPTED |
| 3 | PHASE-03 | `03-phase-test-serve-consumers.md` | PHASE-02 | ACCEPTED |
| 4 | PHASE-04 | `04-phase-runtime-handoff.md` | PHASE-03 | ACCEPTED |
