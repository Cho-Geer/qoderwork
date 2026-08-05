# Phase PHASE-03: Optional Entrypoint (D Layer) [VERIFICATION]

**Phase ID**: `PHASE-03`
**Depends on**: NONE
**Outcome**: `scripts/qoderwork.sh` created as a cross-platform entrypoint that consumes `scripts/lib/workspace-paths.ts` resolver (no hardcoded platform defaults)
**Evidence level**: component
**Progression status**: `ACCEPTED` (previously `BLOCKED-BY-DECISION`; lifted 2026-08-04 by user decision (P3-A); qoderwork.sh created and verified per §7)
**Completion receipt**: `audits/cross-platform-universality-m1/receipts/phase-03.json`
**Amendment origin**: 2026-08-04 user decision lifts DEC-004 BLOCKED-BY-DECISION; PHASE-03 transitions to implementation. Created by plan amendment.

## 1. Input contract + source ledger

| Source | Exact path | Sections used | Authority |
|---|---|---|---|
| Blueprint | `blueprints/blueprint-cross-platform-universality.md` v3 | S2.1 (D layer), S3 Phase 3 | requirements |
| Handoff | `handoff/native-windows-verification.md` | S1 (P0-P3 items) | runtime evidence |

## 2. Decisions, scope, and non-goals

### Decision required from user

**Question** (RESOLVED 2026-08-04 → YES): Should a single entrypoint script `scripts/qoderwork.sh` be created that:
- Detects whether running in Git Bash (`MINGW64_NT`) or WSL Ubuntu
- Sets `WORK_ONE_ROOT` and `QODERWORK_ROOT` appropriately via `scripts/lib/workspace-paths.ts` (not hardcoded)
- Proxies to `bun run scripts/lib/workspace-paths.ts` or other entrypoints

This is marked optional in the blueprint (S2.1 D layer: "可选 — 决策：可选择添加 `scripts/qoderwork.sh`，不是强制项").

**Resolution**: User chose option 1 (YES) on 2026-08-04, lifting DEC-004 BLOCKED-BY-DECISION. PHASE-03 transitions to implementation per §"In scope (decision is YES)" below.

### In scope (decision is YES, as of 2026-08-04)

The implementation worker MUST satisfy ALL of the following constraints. **No platform-default hardcoding is permitted.**

- The script MUST consume `resolveWorkspacePaths({ env: process.env })` from `scripts/lib/workspace-paths.ts` to derive `WORK_ONE_ROOT` and `QODERWORK_ROOT`. Hardcoded platform defaults such as `C:/Users/$USER/workspace/opencode/work-one` or `/home/$USER/workspace/opencode/work-one` are forbidden.
- The script MUST work on **both** Windows Git Bash and WSL Ubuntu. Platform detection (`uname -s` check, `OSTYPE=msys` check, or `grep -qi microsoft /proc/version` for WSL) is allowed, but the resolution MUST route through the resolver, not a literal path.
- The script MUST accept subcommand arguments to proxy to specific tools (e.g., `scripts/qoderwork.sh resolve`, `scripts/qoderwork.sh path`).
- `${QW_WSL_DISTRO:-Ubuntu-24.04}` is the only allowed literal default; all `WORK_ONE_ROOT`/`QODERWORK_ROOT` paths MUST come from the resolver.

### Non-goals

- Do NOT create Windows `.cmd` or `.bat` entrypoints
- Do NOT introduce `QW_ROOT` environment variable
- Do NOT modify existing entrypoints or scripts
- Do NOT modify `scripts/lib/workspace-paths.ts`
- Do NOT include any platform-default literal paths (e.g., `C:/Users/$USER/workspace/opencode/work-one`, `/home/$USER/workspace/opencode/work-one`)

### Forbidden content in any implementation

This phase explicitly does NOT contain executable `.sh` body content in the plan itself. If the implementation worker drafts the script, the draft MUST satisfy every constraint above; otherwise the draft MUST be rejected by the Phase 3 completion gate.

## 3. Verified current baseline

| Claim | Command | Result |
|---|---|---|
| No entrypoint script exists | `test -e scripts/qoderwork.sh; echo $?` | NOT_FOUND (exit 1) |
| No `.cmd` files in scripts/ | `compgen -G 'scripts/*.cmd' >/dev/null; echo $?` | NOT_FOUND (exit 1) |

**Three-state semantics (UNAVAILABLE-aware)**:

| Outcome | Condition | Phase 3 result |
|---|---|---|
| FOUND | probe exits 0 (file/glob match exists) | per-check |
| NOT_FOUND | probe exits 1 (file/glob absent) | per-check (e.g., "no entrypoint = pass") |
| UNAVAILABLE | probe exits 2+ (IO error, permission denied) | **FAIL** — phase blocked; not PASS-by-omission |

For each baseline row above:

- `test -e scripts/qoderwork.sh; echo $?` — rc=0 = FOUND (entrypoint exists); rc=1 = NOT_FOUND (PASS: no entrypoint yet); rc=2+ = UNAVAILABLE (e.g., `scripts/` dir inaccessible) -> FAIL (block). Note: `ls scripts/qoderwork.*` on a non-matching glob returns rc=2 in Git Bash, so it cannot distinguish NOT_FOUND from UNAVAILABLE — `test -e` is the correct probe.
- `compgen -G 'scripts/*.cmd' >/dev/null; echo $?` — rc=0 = FOUND (≥1 `.cmd` file present); rc=1 = NOT_FOUND (PASS); rc=2+ = UNAVAILABLE -> FAIL. (Bash builtin; `ls scripts/*.cmd` returns rc=2 on a non-matching glob, so `compgen -G` is the correct glob probe.)

The other two rows (`OSTYPE`, `/proc/version` probe) are NOT verification gates — they are contextual notes documenting how the existing environments self-identify. They do not have pass/fail semantics for Phase 3.

## 4. End-to-end traceability

| Requirement | Check name | Evidence source | Happy fixture | Single mutation | Test ID |
|---|---|---|---|---|---|
| XP-REQ-007 | XP-ENTRYPOINT | user decision | YES recorded | N/A | N/A |
| XP-REQ-012 | XP-ENTRYPOINT-SCRIPT | `test -x scripts/qoderwork.sh` + `bash scripts/qoderwork.sh resolve` | exit 0 | hardcoded literal / non-resolver | XP-T-009 |

## 5. File change inventory

| Exact path | Change | Anchor |
|---|---|---|
| `scripts/qoderwork.sh` | NEW FILE | bash script calling `resolveWorkspacePaths`; honors `${QW_WSL_DISTRO:-Ubuntu-24.04}` |

If decision is YES, the implementation worker will create `scripts/qoderwork.sh` during execution; that creation **is now prescribed** by this plan-set (no longer depends on BLOCKED-BY-DECISION lift).

## 6. Numbered edit steps

This phase previously had no numbered edit steps at the plan level (BLOCKED-BY-DECISION status). After 2026-08-04 amendment, the worker MUST:

1. Use `scripts/lib/workspace-paths.ts` (via `resolveWorkspacePaths`) as the only source of `WORK_ONE_ROOT` / `QODERWORK_ROOT`. No hardcoded `C:/Users/...` or `/home/$USER/...` literals.
2. Make the script executable from both Windows Git Bash and WSL Ubuntu (both bash-derived; bash script is OK).
3. Cover at least the subcommand `resolve` which proxies to `bun run scripts/lib/workspace-paths.ts`.
4. Honor `${QW_WSL_DISTRO:-Ubuntu-24.04}` as the only allowed WSL distro default.
5. Surface an explicit fail-closed error if the resolver cannot resolve a path — do not silently substitute a default.

## 7. Fixed verification commands

No fixed verification at plan level (Phase 3 is BLOCKED-BY-DECISION). Verification only happens after a YES decision is recorded.

If decision later becomes YES, the worker's verification row MUST include:
- `test -x scripts/qoderwork.sh` exits 0 (FOUND file is executable) — UNAVAILABLE if file missing or non-executable, both of which FAIL the check.
- `bash scripts/qoderwork.sh resolve` runs with `WORK_ONE_ROOT` unset, then sets it via the resolver and re-runs. PASS only if the resolved path equals the resolver's output (`bun run scripts/lib/workspace-paths.ts`).
- Confirm no occurrence of `C:/Users/$USER/workspace/opencode/work-one` or `/home/$USER/workspace/opencode/work-one` literals: `python -c "import re; open('scripts/qoderwork.sh').read(); ..."`. FAIL if either literal appears.

## 8. Single-failure mutation matrix

| Mutation | Expected result | Verification |
|---|---|---|
| Hardcoded `C:/Users/$USER/workspace/opencode/work-one` introduced | literal literal prohibited by §6.1; FAIL | `grep` scan finds the literal -> FAIL |
| Hardcoded `/home/$USER/workspace/opencode/work-one` introduced | literal literal prohibited by §6.1; FAIL | `grep` scan finds the literal -> FAIL |
| Resolver bypassed | verifier checks resolver-equivalence; mismatch -> FAIL | resolve command comparison |
| `QW_ROOT` introduced | forbidden by DEC-002; FAIL | grep scan finds `QW_ROOT=` -> FAIL |
| `tree-kill` introduced | forbidden by DEC-003; FAIL | grep scan finds `tree-kill` -> FAIL |

## 9. Roll-back strategy

- **If created**: `rm scripts/qoderwork.sh` or `git checkout -- scripts/qoderwork.sh`
- **If skipped**: No action needed
- **Risk**: Low — single file, no dependency from other code
- **Rollback verification (if created)**: confirm `test -e scripts/qoderwork.sh` returns rc=1 (NOT_FOUND again). rc=2+ is UNAVAILABLE (e.g., `scripts/` missing) -> FAIL.

## Phase completion gate

- [x] User decision recorded (YES, 2026-08-04); DEC-004 lifted
- [x] `scripts/qoderwork.sh` created, executable, consumes `resolveWorkspacePaths()` (no hardcoded platform defaults), works on both Git Bash and WSL Ubuntu, and verified per §7
- [x] NO hardcoded literal `"C:/Users/$USER/workspace/opencode/work-one"` or `"${HOME}/workspace/opencode/work-one"` in script body
- [x] NO `QW_ROOT` env var introduced
- [x] NO `tree-kill` package introduced
- [x] `bash scripts/qoderwork.sh resolve` runs with `WORK_ONE_ROOT` unset (or set via env) and outputs the resolver's path
- [x] Next Phase prohibition: PHASE-04 does NOT depend on PHASE-03 (PHASE-03 is optional) — but PHASE-05 added 2026-08-04 is the new final implementation phase
