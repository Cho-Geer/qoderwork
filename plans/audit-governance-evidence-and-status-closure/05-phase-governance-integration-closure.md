# Phase PHASE-05: 治理说明与 integration 闭合 `[ANALYSIS→VERIFICATION]`

**Phase ID**: `PHASE-05`
**Depends on**: PHASE-04
**Outcome**: policy、skills、integration fixture 和变更日志一致地要求 canonical contract、contract pre-check、hash-bound LATEST 发布与证据等级不提升。
**Evidence level**: integration
**Progression status**: `NOT_STARTED`
**Completion receipt**: NONE

## Goal

- 完成 REQ-006：在真实临时 Git/workspace fixture 中证明 prepare、pre-check、validator、finalize 与 LATEST 指针形成一条连续 fail-closed 路径，并将唯一操作顺序写入治理说明。

## Starting state and dependency

- Required status: PHASE-04 completion gate is fully checked and its signed ACCEPT audit plus progression receipt pass admission.
- Required evidence before write: human-approved `scope-lock-PHASE-05.json`, nonempty `pre-change-PHASE-05.json`, current HEAD identity, and bounded `rg -n "validateAuditFile|finalizeAudit|precheckContract|LATEST" .agents/skills` caller record.
- Before changing `logs/INDEX.md`, inspect its current diff. If it contains a change not produced by this Phase, record `BLOCKED`, do not overwrite it, and request an owner decision. Other allowed files remain unchanged after this blocking condition.

## Local requirements

| Requirement | Condition | Required behavior | Observable result |
|---|---|---|---|
| REQ-006-A | skill workflow | one ordered command path from contract to publication | no manual `LATEST.md` write instruction remains |
| REQ-006-B | governance rule | ACCEPT needs contract pre-check and audit validator exit 0 | nonzero result forbids publication and phase progression |
| REQ-006-C | integration fixture | real temporary Git repository and workspace paths | prepare, pre-check, validate, and finalize succeed with hash-bound pointer |
| REQ-006-D | mutation fixture | one contract receipt hash or LATEST before-hash changes | finalization rejects and old pointer bytes remain exact |
| REQ-006-E | task documentation | fixed task log and index describe actual scope | text files pass serial nonempty/content/whitespace checks |

## Allowed files

| Exact path | Change | Exact symbol/anchor |
|---|---|---|
| `AGENTS.md` | modify | P-03 audit execution and LATEST publication wording |
| `.agents/skills/plan-audit-archiver/SKILL.md` | modify | audit close sequence and pre-check source-of-truth reference |
| `.agents/skills/deterministic-implementation-planning/SKILL.md` | modify | phase gate status-local checkbox rule |
| `.agents/skills/plan-audit-archiver/scripts/__tests__/audit-governance-integration.test.ts` | add | `AGC-CLOSURE` real Git/workspace fixture |
| `logs/2026-07-25-audit-governance-closure.md` | add | task decision log, 20 lines or fewer |
| `logs/INDEX.md` | modify | entry for the fixed task log |

## Forbidden files and behaviors

- Do not modify implementation scripts, audit templates, historical audit directories, work-one, `bun.lock`, or any user-owned dirty file outside the allowlist.
- Do not duplicate pre-check rule details in prose; the pre-check source remains the rule authority. Do not instruct a user or agent to hand-write `LATEST.md`, bypass finalize, promote component evidence, or declare runtime-smoke/live-LLM-E2E.
- `FOUND`, `NOT_FOUND`, and `UNAVAILABLE` are the integration fixture observation states. Any `NOT_FOUND` or `UNAVAILABLE` dependency is a failed run, never a skipped PASS.

## Fixed contract

- `AGENTS.md` states that an audit report and LATEST publication may occur only through `finalize-audit.ts` after the canonical contract pre-check and audit validator succeed. It states that `LATEST.md` is a hash-bound derived pointer, not a hand-maintained status authority.
- `plan-audit-archiver/SKILL.md` links to the pre-check CLI/API for detailed rules and fixes its command sequence: create canonical contract, run pre-check, render/validate immutable report, atomically publish LATEST pointer, then run progression sync when its separate conditions hold.
- `deterministic-implementation-planning/SKILL.md` states that only `Phase completion gate` checkboxes determine phase completion; accepted gates are all checked and nonaccepted gates are all unchecked.
- The integration test creates a temporary workspace and a temporary Git repository. It writes valid scope, state, receipt, and contract inputs; invokes exported functions or their CLIs; checks report embedded contract, report SHA in LATEST, and validator success.
- The negative integration test mutates exactly one receipt hash after the all-pass baseline and asserts pre-check/finalize failure plus byte-for-byte unchanged previous LATEST. It does not fake filesystem rename or hash functions.
- Write `logs/2026-07-25-audit-governance-closure.md` only after all tests pass. Immediately run `test -s`, `wc -l`, a heading assertion, and `git diff --no-index --check`. Then update `logs/INDEX.md` and run the same four checks. A failed log check is `BLOCKED`.

## Implementation steps

```text
1. Verify Phase-05 Freeze Gate artifacts and inspect logs/INDEX.md ownership before any write.
2. Build the temporary Git/workspace all-pass fixture using real files and real SHA-256 values.
3. Run prepare, exported pre-check, rendered audit validation, and finalize; assert one report and a pointer with its full hash.
4. Mutate exactly one receipt hash and assert finalization leaves old LATEST bytes unchanged.
5. Update AGENTS.md and the two skill documents with the exact ordered workflow and evidence boundary.
6. Run all Phase test suites, typecheck, plan validator, diff and allowlist checks.
7. If all prior checks pass and logs/INDEX.md is owned by this Phase, write the task log, validate it, update the index, and validate it.
8. Preserve every fixture output and stop on any missing, nonzero, ownership, or integrity failure.
```

## Check Registry

| Check name | Source of truth | Read/operation | PASS | Missing/corrupt behavior | Exact failure result |
|---|---|---|---|---|---|
| AGC-CLOSURE-FLOW | temporary Git/workspace | execute complete workflow | report and pointer agree | repository unavailable: UNAVAILABLE | `exit=0` |
| AGC-CLOSURE-POINTER | LATEST and report bytes | SHA-256 comparison | pointer full hash equals report | report absent: NOT_FOUND | `LATEST_REPORT_HASH_MISMATCH` |
| AGC-CLOSURE-NEGATIVE | one receipt-hash mutation | run finalize | old pointer bytes unchanged | receipt absent: NOT_FOUND | pre-check nonzero |
| AGC-CLOSURE-POLICY | three documents | exact phrase and command scan | no manual LATEST path | document unreadable: UNAVAILABLE | policy assertion failure |
| AGC-CLOSURE-LOG | task log and index | serial integrity checks | nonempty, heading, whitespace clean | file absent: NOT_FOUND | integrity command nonzero |

## All-pass Fixture

| Evidence object | Creation method | Required fields/data | Why required |
|---|---|---|---|
| temporary Git repository | `mkdtempSync` plus Git argv | one commit and clean status | external audit truth path |
| temporary workspace | `mkdtempSync` | audit directory, scope, pre/verdict receipts, artifacts | relative ledger boundary |
| canonical contract | prepare output or direct complete JSON | one integration requirement and matching receipts | shared single source |
| immutable report and pointer | finalize output | embedded contract, report SHA, verdict, ceiling | publication proof |

## Single-failure Matrix

| Test ID | Baseline | Only mutation | Expected check | Exact failure result | Other checks |
|---|---|---|---|---|---|
| AGC-I-601 | full fixture | alter one receipt hash | AGC-CLOSURE-NEGATIVE | pre-check nonzero | true |
| AGC-I-602 | full fixture | alter old LATEST before-hash | AGC-CLOSURE-POINTER | `LATEST_PUBLISH_CONFLICT` | true |
| AGC-I-603 | policy text | add manual LATEST instruction | AGC-CLOSURE-POLICY | policy assertion failure | true |
| AGC-I-604 | task log | remove heading after write | AGC-CLOSURE-LOG | integrity command nonzero | true |

## Fixed verification

```bash
cd /home/zhaoge/workspace/qoderwork/.worktrees/check-plan
bun test .agents/skills/deterministic-implementation-planning/scripts/validate-plan.test.ts
bun test .agents/skills/plan-audit-archiver/scripts/__tests__/pre-check-evidence.test.ts
bun test .agents/skills/plan-audit-archiver/scripts/__tests__/validate-audit.test.ts
bun test .agents/skills/plan-audit-archiver/scripts/__tests__/prepare-audit.test.ts
bun test .agents/skills/plan-audit-archiver/scripts/__tests__/finalize-audit.test.ts
bun test .agents/skills/plan-audit-archiver/scripts/__tests__/audit-governance-integration.test.ts
bun run .agents/skills/deterministic-implementation-planning/scripts/validate-plan.ts plans/audit-governance-evidence-and-status-closure
bun run typecheck
git diff --check
git diff --name-only -- AGENTS.md .agents/skills/plan-audit-archiver/SKILL.md .agents/skills/deterministic-implementation-planning/SKILL.md .agents/skills/plan-audit-archiver/scripts/__tests__/audit-governance-integration.test.ts logs/2026-07-25-audit-governance-closure.md logs/INDEX.md
git diff --exit-code -- bun.lock
```

- Required output: AGC-I-601 through AGC-I-604 pass and every earlier Phase suite remains green.
- Expected evidence level: integration. This plan does not establish runtime-smoke or live-LLM-E2E.
- On nonzero, missing, dirty-index ownership conflict, or `UNAVAILABLE` evidence: `BLOCKED`, preserve output, and do not advance.

## Rollback/failure convergence

1. Revert only edits in the six allowed files after preserving test output and text-integrity evidence.
2. Do not overwrite a user-owned `logs/INDEX.md`, delete a failed fixture, edit a historical LATEST pointer, or claim a higher evidence level.

## Phase completion gate

- [ ] Freeze Gate artifacts are valid and PHASE-04 progression is accepted.
- [ ] AGC-I-601 through AGC-I-604 pass with exact results.
- [ ] Policy and skills specify the same canonical contract and single pointer publication path.
- [ ] Task log and logs index pass serial text-integrity checks with no ownership conflict.
- [ ] Typecheck, plan validator, diff check, and allowlist check pass.
