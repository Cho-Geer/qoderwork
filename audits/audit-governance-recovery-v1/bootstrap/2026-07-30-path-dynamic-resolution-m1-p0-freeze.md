# Path Dynamic Resolution M1 — P0 Failure-Site Freeze

- audit_session: `Auditor Session A`
- captured_at: `2026-07-30T07:18:10+09:00`
- repository_root: `/home/zhaoge/workspace/qoderwork/.worktrees/check-plan`
- mode: `READ_ONLY_INVESTIGATION`
- formal_audit_verdict: `NOT_ISSUED`

## 1. Classification

| Object | Classification | Consequence |
|---|---|---|
| Existing four phase audit packages | `HISTORICAL_INVALID_NONREPAIRABLE` | Do not edit, re-hash, relabel, or reuse as acceptance evidence. |
| Existing four pre-change receipts | `INVALID_FOR_CURRENT_IMPLEMENTATION` | They bind obsolete scope-lock hashes and were captured after implementation files had already changed. |
| Existing M1 source delta | `UNACCEPTED_IMPLEMENTATION_CANDIDATE` | Preserve it for later re-baselining; it is neither reverted nor accepted by P0. |
| Existing M1 plan status projection | `UNTRUSTED` | `COMPLETE` / `ACCEPTED` labels cannot override failing machine gates and unchecked final verification. |
| M1 formal re-audit | `BLOCKED_BY_GOVERNANCE_RECOVERY` | P4 may reopen M1 only after the incremental governance recovery is independently accepted. |

This file is an intake/freeze record, not an `ACCEPT`, `REWORK`, or `BLOCKED` implementation audit report.

## 2. Frozen artifact fingerprints

The directory digests are computed from the byte-for-byte stream produced by:

```bash
rg --files -0 <directory> | sort -z | xargs -0 sha256sum | sha256sum
```

| Scope | Files | Manifest SHA-256 |
|---|---:|---|
| `plans/path-dynamic-resolution-m1` | 7 | `3331a98122d9d022a9927d33827531e8424257df366e9ee179b9f069679e7c54` |
| `audits/path-dynamic-resolution-m1` | 80 | `d6ef65c7b9e7fee29f4c03f5a21007ab7c0101bef202cf183ccd109cb32f3081` |
| `audits/path-dynamic-resolution-m1/evidence` | 70 | `f6f3970506815c993054a4e339260cdfc54862be80621e12bedb5f7e4a2a28cc` |

Key immutable fingerprints:

| Artifact | SHA-256 |
|---|---|
| `blueprints/blueprint-dynamic-path-resolution.md` | `6dca61840bb4a9e0e5dbc4443ddc6b75e5a463eb64ea3aeb401f427f0d0e8126` |
| `plans/path-dynamic-resolution-m1/00-plan-index.md` | `5c51ba1a83b41b117c6f88f9684da5a9ef2ab67333b5f7444951595803cafb2a` |
| `plans/path-dynamic-resolution-m1/01-phase-freeze-inventory.md` | `ac5e13da6a0c485779273d9d94fce6e8698365099b358e979e8aba5754fd791f` |
| `plans/path-dynamic-resolution-m1/02-phase-workspace-resolver.md` | `bbffd01e107d71184f7c0119d31fac3068bf8be2565e6f0d7e505cf15e28744c` |
| `plans/path-dynamic-resolution-m1/03-phase-test-serve-consumers.md` | `8f87f2299384fe242fb22aec2ad192687ef56e2ea3c911644909354d9844ebb6` |
| `plans/path-dynamic-resolution-m1/04-phase-runtime-handoff.md` | `58cb9164a41dc43eb1db3f5f6f44814e8b41ba7725f3e1c93549110222eaf07c` |
| `plans/path-dynamic-resolution-m1/99-final-verification.md` | `6062a005da0e31bfff6f66997ac8eb362feb0eb25619a74815b3852a5be04a48` |
| `plans/path-dynamic-resolution-m1/canonical-requirements-contract.yaml` | `0c939357355936ef329b907e75339c38a119791b6dba6fcade5c3e86df2961f2` |
| `audits/path-dynamic-resolution-m1/approval-decision.json` | `3c5d1402f0ccc61d58a305974ea7ec93eb3b025331636c255fc38bdd9f055f77` |
| PHASE-01 scope-lock | `f8263b6c109f23438449704376c8eea504950193d4a9304404c7d24f4d908540` |
| PHASE-02 scope-lock | `886b4713b6c6508b4675f83d81b4a151d1d266e36f634da43c19efaa21d8f3e8` |
| PHASE-03 scope-lock | `ab8f778c1c1da23a0637d3648867f01c639785146666c2a14e0fc4a47f94b73c` |
| PHASE-04 scope-lock | `14c7e56b724b4009548787ae5c4dc7bea7b2707b0ddadf8ebfdbd776c1772eb5` |

## 3. Scope-lock reference graph

Observed EXCLUDED approval edges:

```text
PHASE-01 -> PHASE-02
PHASE-02 -> PHASE-01
PHASE-03 -> PHASE-01, PHASE-02
PHASE-04 -> PHASE-01, PHASE-02, PHASE-03
```

Findings:

- `PHASE-01 <-> PHASE-02` is a direct cycle.
- All 15 EXCLUDED `approval_receipt` hashes differ from their referenced files' current hashes.
- All four locks still describe the approval-decision hash as `95aafa...`; the current approval decision hash is `3c5d140...`.
- The current validator accepts a generic JSON path/hash for EXCLUDED approval and does not mechanically reject scope-lock-to-scope-lock references.

The cycle is therefore both an implementation error and a governance-tooling gap. It must not be repaired by repeatedly synchronizing mutable hashes.

## 4. Existing audit validator results

Command family:

```bash
/home/zhaoge/.bun/bin/bun run \
  .agents/skills/plan-audit-archiver/scripts/validate-audit.ts \
  <audit-report>
```

| Report | Exit | Machine result | Errors |
|---|---:|---|---|
| `2026-07-29-phase-01-audit.md` | 1 | `valid: false` | exclusion approval hash mismatch x4; pre-change scope-lock mismatch; verdict-state scope-lock mismatch |
| `2026-07-29-phase-02-audit.md` | 1 | `valid: false` | exclusion approval hash mismatch x4; pre-change scope-lock mismatch; verdict-state scope-lock mismatch |
| `2026-07-29-phase-03-audit.md` | 1 | `valid: false` | receipt exit/observation mismatch x4; command cwd missing; receipt missing; six scope/receipt errors |
| `phase-04-audit.md` | 1 | `valid: false` | exclusion approval hash mismatch x3; pre-change scope-lock mismatch; verdict-state scope-lock mismatch |

Each report text declares `ACCEPT`; none is currently signable by the mandatory machine gate.

## 5. Pre-change provenance failure

| Phase | `captured_at` | Receipt-bound lock prefix | Current lock prefix | Reusable |
|---|---|---|---|---|
| PHASE-01 | `2026-07-29T09:22:01.105Z` | `f73eba...` | `f8263b...` | no |
| PHASE-02 | `2026-07-29T09:22:01.157Z` | `63325f...` | `886b47...` | no |
| PHASE-03 | `2026-07-29T09:22:01.211Z` | `433be2...` | `ab8f77...` | no |
| PHASE-04 | `2026-07-29T09:22:01.274Z` | `a762e6...` | `14c7e5...` | no |

The receipts only observe `/home/zhaoge/workspace/opencode/work-one` with an empty status and do not freeze the qoderwork implementation workspace. Current filesystem metadata also places representative implementation writes at `2026-07-29T16:00–16:46+09:00`, before the receipts at `18:22+09:00`. A valid pre-change state cannot be reconstructed retroactively.

## 6. Fresh verification snapshot

| Command | Exit | Result | Evidence ceiling |
|---|---:|---|---|
| `bun test scripts/lib/__tests__/workspace-paths.test.ts scripts/__tests__/start-serve-paths.test.ts` | 1 | 18 pass, 1 fail | component |
| `bun test scripts/test-serve/__tests__/run-context.test.ts scripts/test-serve/__tests__/process.test.ts scripts/test-serve/__tests__/bootstrap-import-source.test.ts scripts/test-serve/__tests__/isolated-serve-paths.test.ts` | 0 | 34 pass, 0 fail | component |
| `bun run typecheck` | 0 | `tsc --noEmit --pretty false` | static/type |
| `git diff --check` | 0 | no whitespace errors | static/format |

Aggregate named component result: `52 pass, 1 fail`. The failing case is the DrvFS execute-bit negative case under `/mnt/c/.../noexec`.

No serve, runtime smoke, integration run, or live-LLM E2E was executed.

## 7. Frozen worktree status before this record

- tracked modified: 14
- untracked entries: 7
- `git status --porcelain=v1` SHA-256: `a0b9136a3f244555f28e8fe43bfef01421d800a375690cfefc4a1a2c3d6333ba`

```text
 M .gitignore
 M documents/INDEX.md
 M logs/INDEX.md
 M plans/path-dynamic-resolution-m1/00-plan-index.md
 M plans/path-dynamic-resolution-m1/01-phase-freeze-inventory.md
 M plans/path-dynamic-resolution-m1/02-phase-workspace-resolver.md
 M plans/path-dynamic-resolution-m1/03-phase-test-serve-consumers.md
 M plans/path-dynamic-resolution-m1/04-phase-runtime-handoff.md
 M scripts/start-serve.ts
 M scripts/test-serve/__tests__/bootstrap-import-source.test.ts
 M scripts/test-serve/bootstrap.ts
 M scripts/test-serve/isolated-serve.ts
 M scripts/test-serve/process.ts
 M scripts/test-serve/run-context.ts
?? audits/path-dynamic-resolution-m1/
?? logs/2026-07-29-dynamic-path-m1-implementation.md
?? scripts/__tests__/start-serve-paths.test.ts
?? scripts/lib/__tests__/workspace-paths.test.ts
?? scripts/lib/workspace-paths.ts
?? scripts/local-paths.example.json
?? scripts/test-serve/__tests__/isolated-serve-paths.test.ts
```

## 8. P0 exit decision

- P0 failure-site freeze: `COMPLETE`.
- Existing audit packages: preserve as historical invalid evidence; never repair in place.
- Existing source delta: preserve unchanged until governance recovery is accepted.
- Next permitted action: P1 may create a new incremental governance recovery PLAN_SET and a human approval request.
- Forbidden before approval: source fixes, audit artifact reconstruction, status publication, M1 re-audit, runtime execution, and creation of Implementer Session B.
