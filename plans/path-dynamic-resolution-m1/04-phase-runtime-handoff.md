# Phase PHASE-04: M1 证据收口与后续交接 `[VERIFICATION→OBSERVATION]`

**Phase ID**: `PHASE-04`
**Depends on**: PHASE-03
**Outcome**: M1 的证据边界、已迁移文件和未纳入文件形成可解析交接记录；跨平台 IDE 与其余脚本迁移被明确移交给受批准的后续 PLAN_SET。
**Evidence level**: `manual`; component evidence is retained and runtime-smoke is `NOT-RUN` in M1.
**Progression status**: `NOT_STARTED`
**Completion receipt**: `../../audits/path-dynamic-resolution-m1/evidence/progression-receipt-PHASE-04.json`

## Goal

- 在不扩张 M1 文件范围的条件下保存当前证据，并让弱模型在后续文件清单未经审批时停止。

## Starting state and dependency

- Required status: PHASE-03 is `ACCEPTED`; its component reports, audit verdict, and progression receipt are readable.
- Required evidence: PHASE-01 inventory parses, PHASE-02 and PHASE-03 scope locks remain readable, and no tracked IDE configuration is in the M1 diff.
- If absent: `BLOCKED`; do not write a closure log, edit an index, or claim runtime-smoke.

## Local requirements

| Requirement | Condition | Required behavior | Observable result |
|---|---|---|---|
| REQ-004 | component evidence | retain exact commands and outputs from PHASE-02 and PHASE-03 | evidence ceiling is `component` |
| REQ-004 | runtime requirement | record a separate isolated-serve run as `NOT-RUN` | no runtime-smoke assertion appears |
| REQ-005 | inventory rows outside M1 | place each non-M1 row in continuation register | each row has path, classification, and reason |
| REQ-005 | IDE configuration | name the four tracked files as successor-only targets | no tracked config diff exists |
| REQ-005 | active records | add concise plan completion log and index entries | links point to this M1 plan and evidence ceiling |

## Allowed files

| Exact path | Change | Exact symbol/anchor |
|---|---|---|
| `audits/path-dynamic-resolution-m1/continuation-register.json` | add | `schema_version`, `m1_paths`, `deferred`, `failedChecks` |
| `audits/path-dynamic-resolution-m1/phase-04-audit.md` | add | M1 evidence ceiling and successor rule |
| `documents/INDEX.md` | modify | path dynamic resolution reading entry |
| `logs/2026-07-25-dynamic-path-m1-implementation.md` | add | M1 completion record |
| `logs/INDEX.md` | modify | active log and path-dynamic cluster |

## Forbidden files and behaviors

- Do not edit `.codebuddy/settings.json`, `.codebuddy/settings.local.json`, `.kimi-code/mcp.json`, `.qoder/settings.local.json`, a work-one file, a historical evidence file, or a source file.
- Do not run `opencode serve`, set `H2_AUTHORIZED`, set `DRY_RUN=false`, create a fixed-port test, or promote component output to runtime-smoke or live-E2E.

## Fixed contract

- `continuation-register.json` schema: `{ "schema_version": 1, "m1_paths": [string], "deferred": [{ "path": string, "classification": string, "reason": string, "required_admission": "APPROVED_SUCCESSOR_PLAN" }], "failedChecks": string[] }`.
- `m1_paths` equals the fourteen source/test/example/ignore paths listed for PHASE-02 and PHASE-03, excluding audit artifacts. Every inventory entry not in that list appears once in `deferred`.
- Four tracked IDE configuration paths appear in `deferred` with `classification: "LOCAL_CONFIG"`; their `required_admission` is `APPROVED_SUCCESSOR_PLAN`.
- Negative states: `FOUND / NOT_FOUND / UNAVAILABLE`. A missing inventory is `UNAVAILABLE`; a deferred row missing its admission value fails as `CONTINUATION_ROW_INVALID`.
- Evidence ceiling: component test output may claim only component. `runtime-smoke` and `live-E2E` are `NOT-RUN` until a successor uses the existing isolated-serve lifecycle and retains its manifest, dual DB paths, SSE output, PID data, and cleanup result.

## Implementation steps

```text
1. Verify PHASE-03 acceptance and read the inventory plus component reports.
2. Create continuation-register.json from inventory entries not in m1_paths; do not add a source path to the M1 diff.
3. Create phase-04-audit.md stating the component ceiling and the separate successor admission rule.
4. Write the dated M1 log, then update documents/INDEX.md and logs/INDEX.md one file at a time with their integrity checks.
5. Run plan validation and scope checks. If any deferred row is malformed or a forbidden file changed, mark BLOCKED.
```

## Check Registry

| Check name | Source of truth | Read/operation | PASS | Missing/corrupt behavior | Exact failure result |
|---|---|---|---|---|---|
| PDR-EVIDENCE | PHASE-02/03 reports | parse retained command results | component-only labels present | unreadable report | `COMPONENT_EVIDENCE_UNAVAILABLE` |
| PDR-CEILING | phase-04 audit | inspect evidence wording | runtime-smoke and live-E2E are `NOT-RUN` | missing audit | `EVIDENCE_CEILING_INVALID` |
| PDR-CONTINUATION | register JSON | compare inventory to `m1_paths` | one deferred row per external path | absent/malformed register | `CONTINUATION_ROW_INVALID` |
| PDR-IDE-SCOPE | Git diff and register | inspect four tracked config paths | config diff absent; four deferred rows present | unavailable diff | `IDE_SCOPE_INVALID` |
| PDR-ACTIVE-RECORDS | index and log files | read headings and plan link | three activity records parse | missing record | `ACTIVITY_RECORD_INVALID` |

## All-pass Fixture

| Evidence object | Creation method | Required fields/data | Why required |
|---|---|---|---|
| component reports | retained PHASE-02/03 command output | exit code and command label | preserves evidence level |
| inventory | PHASE-01 artifact | classified path entries | drives deferred set |
| continuation register | deterministic JSON serialization | M1 path list and deferred rows | blocks scope expansion |
| active records | serial Markdown writes | index headings and dated log | makes handoff discoverable |

## Single-failure Matrix

| Test ID | Baseline | Only mutation | Expected check | Exact failedChecks/error | Other checks |
|---|---|---|---|---|---|
| PDR-M-301 | retained component report | remove command output | PDR-EVIDENCE | `COMPONENT_EVIDENCE_UNAVAILABLE` | PDR-CONTINUATION remains true |
| PDR-M-302 | valid deferred row | remove `required_admission` | PDR-CONTINUATION | `CONTINUATION_ROW_INVALID` | PDR-CEILING remains true |
| PDR-M-303 | no IDE config diff | modify one tracked config file | PDR-IDE-SCOPE | `IDE_SCOPE_INVALID` | PDR-CONTINUATION remains true |
| PDR-M-304 | `NOT-RUN` runtime entry | replace with runtime PASS text | PDR-CEILING | `EVIDENCE_CEILING_INVALID` | PDR-EVIDENCE remains true |

## Fixed verification

```bash
cd /home/zhaoge/workspace/qoderwork/.worktrees/check-plan
test -s audits/path-dynamic-resolution-m1/continuation-register.json
/home/zhaoge/.bun/bin/bun -e 'const x=JSON.parse(await Bun.file("audits/path-dynamic-resolution-m1/continuation-register.json").text()); if(x.schema_version!==1 || !Array.isArray(x.deferred) || x.deferred.some((r)=>r.required_admission!=="APPROVED_SUCCESSOR_PLAN")){process.exit(1)}'
git diff --check
git diff --name-only -- .codebuddy/settings.json .codebuddy/settings.local.json .kimi-code/mcp.json .qoder/settings.local.json
/home/zhaoge/.bun/bin/bun run .agents/skills/deterministic-implementation-planning/scripts/validate-plan.ts plans/path-dynamic-resolution-m1
```

- Required output/artifacts: component evidence references, continuation JSON, M1 audit, dated log, two synchronized indexes, and structural validator output.
- On nonzero output, a tracked IDE config diff, missing evidence, or evidence-level inflation: `BLOCKED`; preserve artifacts; do not advance.

## Rollback/failure convergence

1. Revert only the five listed Phase-04 files after retaining the failure output under the audit directory.
2. Do not erase deferred entries, create a successor scope lock without human approval, or claim a runtime result from a component command.

## Phase completion gate

- [ ] Allowed-file diff only
- [ ] Continuation register parses and names each external inventory entry once
- [ ] Four tracked IDE files are deferred and absent from the diff
- [ ] Component, runtime-smoke, and live-E2E labels match retained evidence
- [ ] Log and indexes pass their serial text integrity checks
- [ ] Successor admission rule is present and no unapproved source migration occurred
