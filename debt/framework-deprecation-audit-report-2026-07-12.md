# Framework Deprecation-Content Audit — Completion Report (2026-07-12)

## Scope
Audit of dead/stale content in the `work-one` OpenCode multi-agent framework, executed across 6 phases per `blueprints/2026-07-12-framework-deprecated-content-audit-blueprint.md`. Each phase committed separately as `[INFRA]`, **no push** (per user instruction).

## Commits landed (HEAD, work-one repo)
| Phase | Commit | Change |
|-------|--------|--------|
| P2 | `7e56fadc` | plugin-handler classification + delegate relabel |
| P3 | `c9c49c80` | drop `getEnforcementModeWithSource()` from hook callers |
| P4 | `5f712675` | retire DAG/pre-execution gate scripts -> `legacy/`; repoint probes; replace 3x `@Meta-Planner` -> `@plan` in dispatch-validate.ts |
| P5 | `42c31d22` | `isWriteAllowed()` caller -> `isPathAllowedForAgent()`; drop `dbInsertDispatchContext()` re-exports |
| P5b | `359af509` | remove `getEnforcementModeCompat()` / `isStrictOrLockedCompat()` shims from rule-disposition.ts |
| P4b | `a0519836` | framework-self-test Check 23 label -> "archived in legacy/" (probe paths already legacy) |

Supporting (pre-existing this session): `b4a62fb9` pre-commit gate non-blocking on stale sessions; `eaf2bb5e` Phase 1 AGENTS.md doc audit.

## Validation results
- **Zero runtime callers** for all removed APIs (`getEnforcementModeCompat`, `isStrictOrLockedCompat`, `isWriteAllowed` as caller, `dbInsertDispatchContext`) — confirmed via `rg` across `.opencode/**/*.ts`.
- **pre-execution-gate/hook** in operational `.ts`: every reference is inside `legacy/` (retired archive) or a comment/probe **repointed to `legacy/`**. No operational script asserts the gate at the active path. PASS.
- **`@plan`** confirmed in committed HEAD `dispatch-validate.ts` (3 sites: lines 331/345/363). PASS.
- Pre-commit compliance gate passed (RC=0, bun in PATH) on every audit commit.
- Serve-api liveness: `http://127.0.0.1:4096/` -> HTTP 200; framework loaded (Orchestrator session listed).

## Findings / follow-ups
1. **Residual `@Meta-Planner` in other message files** (outside executed P4 scope): `gate-validate.ts:131/134`, `checklist-phase.ts:154`, `prompt-sections.ts:123`, `route-validator-l0-l2.ts:44`, `framework-doctor.ts:1269` (comment). P4 replaced only the 3 sites in `dispatch-validate.ts`. Recommend a follow-up pass if a full agent-name purge is desired.
2. **Serve loads the feature working tree, not HEAD.** Audit commits are in git history, but the running `opencode serve` loads files from disk (feature-branch versions). Runtime validation of the audit edits therefore requires loading HEAD (e.g., `git checkout HEAD -- <files>` + restart serve), which would disturb the uncommitted feature work — scoped out per the user's "scoped audit commits" decision.
3. **Feature-integration caveat.** The feature working tree retains pre-audit versions of 8 audit-touched files. When the feature branch is later committed, those files must be reconciled against the audit HEAD or the audit edits will be reverted/conflicted.

## Status
Audit execution: **COMPLETE** (6 commits, no push). No blocking issues. Two follow-up items documented above.
