# Framework Deprecated Content Audit Blueprint

**Date**: 2026-07-12
**Target repo**: `/home/zhaoge/workspace/opencode/work-one`
**Output repo**: `/home/zhaoge/workspace/qoderwork`
**Scope**: framework runtime code, active startup prompts, plugin dispatchers, framework scripts, compatibility bridges, and framework-facing docs that are loaded or likely to guide future sessions.

This document started as an evidence-first audit blueprint. It now also carries a post-implementation review update so the original baseline and the current verification status stay in one place.

## Status Update (2026-07-12, post-implementation review)

- **Blueprint execution in git history**: implementation commits are recorded in `/home/zhaoge/workspace/qoderwork/debt/framework-deprecation-audit-report-2026-07-12.md`.
- **Current worktree verification status**: **NOT FULLY RECONCILED**.
- **Decision**: do **not** mark this blueprint fully complete for the current workspace snapshot. The report shows cleanup commits landed in git history, but the current `work-one` working tree still contains active/runtime stale content that violates the original done criteria.

## Post-Implementation Review Findings (current worktree)

### F1: Phase 5b is not reflected in the current worktree

Evidence:

- `.opencode/service/enforcement/rule-disposition.ts:144-155` still exports deprecated `getEnforcementModeCompat()` and `isStrictOrLockedCompat()`.

Impact:

- The completion report says Phase 5b removed these shims, but the current working tree still exposes them to runtime consumers.
- Done criterion "`deprecated APIs are zero outside tests/archive, or each remaining caller has an explicit compatibility reason`" is not satisfied for the current workspace snapshot.

### F2: Phase 3 hook-caller retirement is not reflected in the current worktree

Evidence:

- `.opencode/hooks/lib/hook-commit-msg.ts:24-27` still imports `getEnforcementModeWithSource`.
- `.opencode/hooks/lib/hook-commit-msg.ts:64-82` still calls it to produce compatibility logging.
- `.opencode/service/gate/enforcement.ts:47-63`, `.opencode/service/gate/query.ts:14`, and `.opencode/service/gate/index.ts:47-48` still expose the deprecated mode-based API.

Impact:

- The completion report says Phase 3 dropped hook callers, but the current workspace still has a live hook caller.
- Active runtime is still partly mode-compatibility based in user-visible hook behavior.

### F3: Active runtime messages still emit retired `@Meta-Planner` guidance

Evidence:

- `.opencode/service/dispatch/dispatch-validate.ts:337`, `:351`, and `:369` still tell the caller to dispatch `@Meta-Planner`.
- `.opencode/tools/dispatch_subagent.ts:25-26` still describes `auto_plan` as auto-dispatching `@Meta-Planner`.
- `.opencode/service/gate/gate-validate.ts:133-136` still tells operators to use `@Meta-Planner` and still lists `@Meta-Planner` as a DAG-exempt agent.

Impact:

- The completion report correctly warned that current serve/runtime may still differ from HEAD, and this is one concrete place where that mismatch is still visible.
- Done criterion "`Serve API smoke test ... without stale @Meta-Planner guidance`" is not satisfied for the current workspace snapshot.

### F4: Old pre-execution scripts are still treated as required operational scripts in the current worktree

Evidence:

- `.opencode/scripts/install-hooks.ts:21-30` still lists `.opencode/scripts/pre-execution-gate.ts` and `.opencode/scripts/pre-execution-hook.sh` in `REQUIRED_EXECUTABLE_SCRIPTS`.

Impact:

- This still conflicts with the intended retirement/archive direction described in Phase 4 of the blueprint.
- Done criterion "`no contradiction between startup docs and operational scripts`" is not satisfied for the current workspace snapshot.

## Status Decision

- **Historical implementation status**: commits landed and are documented in the debt report.
- **Current workspace status**: **partially implemented / verification failed against working tree**.
- **Required follow-up before marking complete**:
- Reconcile the current working tree files with the landed audit commits.
- Re-run the code review on the reconciled working tree.
- Re-check the original done criteria in this blueprint against files on disk, not only git history.

## Audit Baseline

- CodeGraph status was up to date: 421 files, 4,366 nodes, 14,130 edges.
- Current registered agents from `opencode.json` are only `Orchestrator`, `build`, `general`, `plan`, and `explore`; there is no active `Scout`.
- Current plugin entrypoints from `opencode.json` are `before-dispatcher.ts`, `after-dispatcher.ts`, `system-dispatcher.ts`, `session.ts`, and `tool-def-trimmer.ts`.
- Current active handler order from `.opencode/project.config.json` is before 11, after 7, system 2.
- The `work-one` worktree is dirty. Line references below describe the current workspace snapshot, not a clean `HEAD`.

Commands used as primary evidence:

```bash
codegraph status
codegraph query "deprecated"
codegraph query "legacy"
codegraph callers "getEnforcementMode"
codegraph callers "getEnforcementModeWithSource"
codegraph callers "getEnforcementModeCompat"
codegraph callers "checkDagExists"
codegraph callers "dbInsertDispatchContext"
codegraph callers "isWriteAllowed"
jq '.agent' opencode.json
jq '.plugin' opencode.json
rg -n "LEGACY HANDLER|DELEGATE HANDLER|Scout|scout|pre-execution-gate|ENFORCEMENT_MODE|framework-enforcer"
```

## Executive Summary

The framework still contains deprecated or stale material in three risk bands.

P0/P1 items are not just historical noise. They can mislead new sessions or re-inject retired concepts into active prompts:

- `AGENTS.md` still mentions `Scout` in the P0 execution rule and research dispatch rule.
- `AGENTS.md` says `before-dispatcher.ts` is not active, but `opencode.json` registers it and `project.config.json` actively orders its handlers.
- Legacy agent profiles still mention `Knowledge-Curator / Scout`; those profiles can still be loaded because `resolveDispatchTarget()` maps legacy role names to native executors.
- Old DAG/pre-execution scripts are still treated as required executable framework scripts by `install-hooks.ts`, despite the current startup document saying the old DAG governance chain is not active.

P2 items are compatibility tails that may be intentional for migration, but need a documented removal path:

- `getEnforcementMode*` compatibility shims remain exported and partially called.
- per-agent write permission checks are marked deprecated but still have a runtime caller through write audit.
- `dispatch_context` has been dropped from DB schema, but `dbInsertDispatchContext()` remains exported as a warning-only stub.
- handler files labelled `LEGACY HANDLER` have mixed status: some are truly rollback-only, while others are still active via delegate `require()`.

Recommended path: first fix prompt/documentation drift, then build a handler/API inventory, then retire compatibility shims in small batches with CodeGraph caller checks and serve-API smoke tests.

## Findings

### P0: Startup Instructions Contradict Current Runtime

Evidence:

- `AGENTS.md:38-50` says preflight should decide whether `Scout / native Task` is needed and says research/evidence gathering should use `Scout / research / evidence gathering`.
- `AGENTS.md:67-73` lists stale model names such as `opencode-go/deepseek-v4-pro` and `volcengine-plan/glm-5.2`.
- `opencode.json:17-19`, `opencode.json:118-121`, `opencode.json:210-213`, `opencode.json:295-298`, and `opencode.json:335-338` show all five current agents use `deepseek/deepseek-v4-flash`.
- `AGENTS.md:81-83` says `before-dispatcher.ts` exists but is not connected to the active chain.
- `opencode.json:399-404` registers `before-dispatcher.ts`, `after-dispatcher.ts`, and `system-dispatcher.ts` as plugin entrypoints.
- `.opencode/project.config.json:1906-1932` defines active before/after/system execution order.

Impact:

- Every new agent session loads `AGENTS.md`, so stale instructions become live behavioral guidance.
- The `Scout` wording conflicts with the retirement decision and can cause agents to plan around a non-existent native agent.
- The dispatcher statement is actively wrong and may cause maintainers to debug the wrong layer.

Recommendation:

- Update `AGENTS.md` immediately to remove `Scout`, correct model names, and state that dispatchers are active plugin entrypoints.
- Add a lightweight startup consistency check that compares `AGENTS.md` claimed agent/model/plugin counts against `opencode.json` and `project.config.json`.

### P1: Scout Is Retired in Active Runtime but Still Present in Legacy Profiles

Evidence:

- `.opencode/service/dispatch/agent-target.ts:97-99` now hard-rejects `scout` and tells callers to use `explore`.
- `.opencode/legacy/agent-profiles/Architect.md:45-48` mentions `Knowledge-Curator / Scout style research`.
- `.opencode/legacy/agent-profiles/Super-Admin.md:57-60` mentions `Knowledge-Curator / Scout evidence`.
- Similar `Scout` mentions exist in legacy profiles for `Meta-Planner`, `Arbiter`, `Coder-BE`, `Coder-FE`, and `CI-CD-Agent`.
- `.opencode/service/dispatch/agent-target.ts:18-64` still maps legacy role names to native executors and profile files.
- `.opencode/service/dispatch/prompt-builder.ts:120-139` resolves and reads those profile files when a legacy role is requested.

Impact:

- Active `Scout` dispatch is blocked, but legacy role dispatch can still inject `Scout` into the child prompt.
- This is not purely archival because `resolveDispatchTarget()` keeps those profiles reachable.

Recommendation:

- Replace all legacy profile `Scout` wording with `explore` or `Knowledge-Curator` only.
- Keep the hard retirement guard for direct `scout` dispatch.
- Decide whether legacy roles are still supported compatibility aliases. If yes, rename them in docs as "compat roles" and scrub their prompts. If no, reject them like `scout`.

### P1: Legacy Role Routing and Permission Fallback Are Still Runtime-Reachable

Evidence:

- `.opencode/service/dispatch/agent-target.ts:18-64` defines `LEGACY_ROLE_MAP` for `Meta-Planner`, `Architect`, `Coder-BE`, `Coder-FE`, `Guardian`, `Arbiter`, `CI-CD-Agent`, `Knowledge-Curator`, and `Super-Admin`.
- `.opencode/service/dispatch/router.ts:172` calls `resolveDispatchTarget()`.
- `.opencode/service/dispatch/prompt-builder.ts:120` calls `resolveDispatchTarget()`.
- `.opencode/service/permission/reader.ts:113-119` marks per-agent permission lookup deprecated.
- `.opencode/service/permission/reader.ts:137-145` falls back to `LEGACY_AGENT_PERMISSIONS`.
- `.opencode/service/permission/legacy-agent-permissions.ts:3` contains a large legacy permission table.

Impact:

- The runtime claims five agents, but code still accepts nine historical role names as compatibility aliases.
- Permissions can silently come from a legacy table if a caller uses an old display name not present in `opencode.json`.
- This creates a split-brain between "actual running agents" and "accepted dispatch identities".

Recommendation:

- Choose one of two explicit policies:
- Policy A, strict retirement: reject all legacy role dispatches with a clear error and remove `LEGACY_AGENT_PERMISSIONS` after caller checks pass.
- Policy B, compatibility freeze: keep legacy aliases but document them as aliases, scrub stale prompts, and add tests proving each alias maps to the intended native executor and permission behavior.
- For the current framework, Policy B is safer short-term because `dispatch_subagent` and some tests still assume compatibility behavior. Policy A should be the long-term simplification target.

### P1: Old DAG / Pre-Execution Gate Scripts Are Still Operationally Referenced

Evidence:

- `AGENTS.md:6-10` says the old `Task.DAG.json` / `@Meta-Planner` governance chain is historical and not current runtime.
- `.opencode/scripts/pre-execution-hook.sh:1-13` presents itself as a multi-stage pre-execution validation hook.
- `.opencode/scripts/pre-execution-hook.sh:95-118` invokes `pre-execution-gate.ts` when available.
- `.opencode/scripts/install-hooks.ts:21-31` still treats `.opencode/scripts/pre-execution-gate.ts` and `.opencode/scripts/pre-execution-hook.sh` as required executable framework scripts.
- `.opencode/scripts/framework-doctor.ts:933-948` probes `pre-execution-gate.ts`.
- `.opencode/service/dispatch/dispatch-validate.ts:337-369` still emits hardcoded `Task.DAG.json` / `@Meta-Planner` guidance when DAG policy blocks.

Impact:

- The codebase has both "DAG chain is historical" and "DAG gate scripts are required framework operation" signals.
- Future maintainers may waste time debugging retired scripts or accidentally re-enable old DAG-first behavior.

Recommendation:

- Decide whether `pre-execution-gate.ts` and `pre-execution-hook.sh` are active support scripts or legacy rescue tools.
- If legacy: move them under `.opencode/legacy/scripts/`, remove them from `install-hooks.ts`, and update `framework-doctor.ts` to report "legacy script archived" rather than requiring it.
- If active: update `AGENTS.md` to say the DAG gate is still an operational support path and define when it runs.
- Replace `@Meta-Planner` remediation messages in active code with current `plan` / `Orchestrator` / `explore` wording or explicitly mark them as compatibility-mode messages.

### P1: Handler Labels Do Not Match Actual Reachability

Evidence:

- `.opencode/plugin-handlers/before/config-guard.ts:2`, `git-guard.ts:2`, `anti-bypass.ts:2`, and others are labelled `LEGACY HANDLER`.
- `.opencode/plugin-handlers/before/permission-safety.ts:8-19` dynamically requires `config-guard` and `git-guard`.
- `.opencode/plugin-handlers/before/guidance-bridge.ts:8` dynamically requires before `anti-bypass`.
- `.opencode/plugin-handlers/after/guidance-recovery.ts:8` dynamically requires after `anti-bypass`.
- `.opencode/plugin-handlers/after/unified-audit.ts:13-17` delegates to `read-track`, `scope`, and `codegraph`.
- `.opencode/plugin-handlers/after/quality-contract.ts:198-202` delegates to `format` and `tdd`.
- `.opencode/plugins/before-dispatcher.ts:16` imports `uc7ks` but does not put it in `HANDLER_MAP`.
- `.opencode/plugins/after-dispatcher.ts:13` imports `auditHandler` but does not put it in `HANDLER_MAP`.

Impact:

- A file labelled legacy may still be active through a delegate path.
- Dead imports in dispatchers make the "active order" harder to reason about and can preserve module side effects.

Recommendation:

- Create a handler manifest with one status per handler: `active-direct`, `active-delegate`, `retired-rollback`, or `delete-candidate`.
- Rename comments in delegate handlers from `LEGACY HANDLER` to `DELEGATE HANDLER`.
- Remove unused dispatcher imports for `uc7ks` and `auditHandler`.
- Add a test that every handler in `plugin_execution_order` exists in `HANDLER_MAP`, and every dynamic delegate is documented in the manifest.

### P1: Enforcement Mode Migration Is Incomplete

Evidence:

- `.opencode/service/enforcement/rule-disposition.ts:1-6` says per-rule disposition replaces global enforcement mode.
- `.opencode/service/enforcement/rule-disposition.ts:136-155` still exports deprecated `getEnforcementModeCompat()` and `isStrictOrLockedCompat()`.
- `.opencode/service/gate/enforcement.ts:47-63` still exports deprecated `getEnforcementMode()` and `getEnforcementModeWithSource()`.
- `.opencode/hooks/lib/hook-layers.ts` and `.opencode/hooks/lib/hook-commit-msg.ts` still call `getEnforcementModeWithSource()` to report ignored legacy env overrides.
- `.opencode/scripts/pre-execution-gate.ts:203` requires `getEnforcementModeCompat()`.
- `.opencode/project.config.json:222-228` says legacy scripts may still read historical mode fields.
- `.opencode/rules/rule_detail/enforcement-modes-standard.md` still documents `ENFORCEMENT_MODE` behavior.

Impact:

- The runtime policy is per-rule disposition, but docs and scripts still suggest mode-based behavior.
- Compatibility shims can obscure whether a branch is truly rule-based or only pretending to be strict.

Recommendation:

- Replace hook callers with direct rule-disposition wording or a static "legacy env override ignored" log path.
- Move old `ENFORCEMENT_MODE` docs to an archive section or rewrite them as migration history.
- Remove `getEnforcementModeCompat()` once `pre-execution-gate.ts` is retired or migrated.
- Remove `getEnforcementMode()` / `getEnforcementModeWithSource()` exports only after CodeGraph callers are zero outside tests and bridges.

### P2: Deprecated DAG Helpers Remain Exported Through Bridges

Evidence:

- `.opencode/service/gate/enforcement.ts:109-160` exports deprecated `checkDagExists()`, `checkTaskInDag()`, and `checkDagProgress()`.
- `.opencode/service/gate/index.ts` re-exports those functions.
- `.opencode/lib/gate-core.ts` is a bridge that preserves old import paths and re-exports deprecated APIs.
- CodeGraph caller checks showed `checkDagExists()` has no direct runtime callers beyond re-export bridges.

Impact:

- Deprecated APIs remain discoverable and importable, so new code can accidentally depend on them.
- Bridge files are useful during migration but need a sunset rule.

Recommendation:

- Add a `compat-exports.md` or inline manifest listing bridge exports and planned removal dates.
- Remove re-exports for deprecated DAG helpers after tests and scripts no longer import them.
- If historical scripts still need them, move those imports inside `.opencode/legacy`.

### P2: Deprecated Per-Agent Write Audit Still Has a Runtime Caller

Evidence:

- `.opencode/service/gate/checks.ts:131-139` marks `isWriteAllowed()` deprecated and says there is one runtime caller.
- `.opencode/service/file-guard/audit.ts:6` imports `isWriteAllowed`.
- `.opencode/service/file-guard/audit.ts:60` calls `isWriteAllowed(agent, file)`.
- `.opencode/service/permission/reader.ts:180-232` already has `isPathAllowedForAgent()`, but it is still agent-identity based.

Impact:

- The framework is migrating toward behavior/path-based enforcement, but write audit still reports and reasons through agent identity.
- This increases overlap with `permission-safety`, `behavioral-path-guard`, and `scope`.

Recommendation:

- Replace `executeWriteAuditCheck()` scope validation with the same behavior/path contract used by active write guards.
- Keep audit as evidence collection, not a second source of permission truth.
- Add a unit test proving a file write is blocked by the primary guard and merely recorded by audit.

### P2: Dropped `dispatch_context` Still Has Exported Stub API

Evidence:

- `.opencode/lib/db-manager.ts:1765-1777` documents v23 dropping `dispatch_context`.
- `.opencode/service/dispatch/session-log.ts:33-54` keeps `dbInsertDispatchContext()` as a deprecated warning-only stub.
- `.opencode/lib/dispatch-db.ts` and `.opencode/service/dispatch/index.ts` re-export the stub.
- CodeGraph caller checks showed no live call sites beyond re-export bridges.

Impact:

- The function name suggests a working DB insert, but it always returns `null`.
- Future code may import it and silently lose state.

Recommendation:

- Remove the stub from public bridge exports after tests pass.
- If backward compatibility is required, make the stub throw in non-test runtime so misuse is caught immediately.

### P2: Framework Code Still Carries Booking Demo Assumptions

Evidence:

- `AGENTS.md:6-10` says `booking-backend` / `booking-frontend` are historical demo project material.
- `.opencode/project.config.json:4-16` still identifies the project as `booking-system` and points to `booking_system_refactor/`.
- `.opencode/project.config.json:231-254` still contains backend/frontend stack variables for NestJS and Angular booking code.
- `opencode.json:39-54` and legacy permission tables still encode path permissions for historical app paths or broad `src/**` scopes.

Impact:

- It is unclear whether `work-one` is now a pure framework repo or still coupled to the booking demo.
- The ambiguity can cause permission and knowledge-routing rules to fire for paths that may no longer be the target project.

Recommendation:

- Decide whether booking-system is still a bundled fixture, a real current project, or historical sample data.
- If fixture: move app-specific config under a fixture profile and keep framework defaults project-neutral.
- If historical: remove or archive booking-specific config from active `project.config.json`, `opencode.json`, and startup docs.

### P3: QoderWork Documentation Index Contains Known Stale Scout Wording

Evidence:

- `/home/zhaoge/workspace/qoderwork/documents/INDEX.md:29` summarizes native OpenCode as `Plan/Build/General/Explore/Scout`.

Impact:

- This does not directly affect `work-one` runtime, but it can mislead future framework planning.

Recommendation:

- Update QoderWork docs to say OpenCode v2 has no built-in `Scout`; use `explore` for read-only investigation.
- Mark older native-opencode integration recommendations as historical if they were written against pre-v2 assumptions.

## Integrated Remediation Track: F5 / F6 Backup Artifacts

This section supersedes the deleted standalone file `blueprints/blueprint-f5-f6-backup-artifact-remediation.md`. Weak models must use this section as the only execution source for backup-artifact cleanup.

### Verified Facts

- `F5` is a historical finding and is already fixed in the current worktree snapshot reviewed by the standalone audit.
- `F6` is directionally true, but the original document undercounted the affected files. The real issue is broader: stray backup artifacts exist outside approved archive/runtime-backup paths, and blanket `.gitignore` rules can hide them.

### Single-Path Policy

Use exactly this implementation path. Do not invent alternatives:

1. Move stray backup artifacts out of live source paths into a controlled quarantine directory. Do not hard-delete first.
2. Remove blanket ignore rules that hide stray backups in normal workflow.
3. Add one repository-wide stray-backup scanner for both local and CI use.
4. Wire that scanner into pre-commit and CI only after the protected files are clean.
5. Update `team-elevation` documents only after the guard is active and the live-path artifacts are gone.

### Allowed Backup Locations

Only these locations may keep backup-style artifacts:

- `.opencode/.trash-*/**`
- `.opencode/state/.backups/**`
- `.opencode/state/framework-state.db*`

Any file outside those locations that matches one of the following patterns is a violation:

- `*.bak`
- `*.bak-*`
- `*.bak-pre-*`
- `*.bak-phase*`

### Protected Files

Until the serial gate opens, weak models must not modify these files:

- `.opencode/hooks/lib/hook-layers.ts`
- `.opencode/scripts/ci-semantic-validator.ts`
- `.gitignore`
- `.opencode/project.config.json`
- `.opencode/scripts/install-hooks.ts`
- `.opencode/service/dispatch/prompt-builder.ts`
- `.opencode/service/enforcement/tool-tracker.ts`
- `.opencode/legacy/scripts/pre-execution-gate.ts`

### Parallel-Safe Steps

These steps may run now in parallel with other framework cleanup work because they do not change protected entrypoints or touch canonical files already under active churn.

1. Create quarantine directory:
   `/home/zhaoge/workspace/opencode/work-one/.opencode/.trash-phase0/manual-backup-quarantine/2026-07-12-f5-f6/`
2. Record the full current stray-backup inventory as pre-change evidence.
3. Verify canonical files exist for these non-conflicting artifacts:
   - `./.gitignore`
   - `./opencode.json`
   - `./docs/review/framework-refactor/compliance-gate-dispatch-integrity-fix.md`
   - `./docs/review/framework-refactor/uc7ks-read-before-write-plan.md`
4. Move these five non-conflicting artifacts into quarantine while preserving relative paths:
   - `.gitignore.bak`
   - `opencode.json.bak`
   - `opencode.json.bak-pre-smoke0`
   - `docs/review/framework-refactor/compliance-gate-dispatch-integrity-fix.md.bak`
   - `docs/review/framework-refactor/uc7ks-read-before-write-plan.md.bak`
5. Confirm those five original paths no longer exist.
6. Create `.opencode/scripts/ci/check-no-stray-backups.ts`.
7. Implement only the standalone scan logic in that script:
   - scan `git ls-files`
   - scan `git ls-files --others --ignored --exclude-standard`
   - merge results
   - compare against the allowlist above
   - print sorted violations
   - exit non-zero on any violation
8. Validate the new scanner standalone before any hook/CI wiring.

### Serial-Only Steps

These steps must wait until the protected files are no longer being actively changed by the deprecated-content cleanup track.

1. Verify the canonical files exist for these three conflicting artifacts:
   - `./.opencode/service/dispatch/prompt-builder.ts`
   - `./.opencode/service/enforcement/tool-tracker.ts`
   - `./.opencode/project.config.json`
2. Move these three conflicting artifacts into quarantine:
   - `.opencode/service/dispatch/prompt-builder.ts.bak-pre-t17`
   - `.opencode/service/enforcement/tool-tracker.ts.bak-phase3`
   - `.opencode/project.config.json.bak-pre-smoke1`
3. Modify `.gitignore`:
   - remove blanket rules that hide stray backups
   - keep only approved archive/runtime-backup ignores
4. Integrate the scanner into `.opencode/hooks/lib/hook-layers.ts` so pre-commit blocks stray backups.
5. Integrate the scanner into `.opencode/scripts/ci-semantic-validator.ts` so CI blocks stray backups even when `--no-verify` was used locally.
6. Update:
   - `/home/zhaoge/workspace/qoderwork/team-elevation/04-architecture-review.md`
   - `/home/zhaoge/workspace/qoderwork/team-elevation/README.md`
7. Only after all previous serial steps pass, update document wording to:
   - `F5`: historical finding, fixed
   - `F6`: was true, scope was larger than the first three-file description, now fixed by quarantine plus enforcement guard

### Serial Gate Conditions

Do not start the serial-only steps until all of the following are true:

1. `git status --short` no longer shows active modifications for:
   - `.opencode/project.config.json`
   - `.opencode/scripts/install-hooks.ts`
   - `.opencode/service/dispatch/prompt-builder.ts`
   - `.opencode/service/enforcement/tool-tracker.ts`
   - `.opencode/legacy/scripts/pre-execution-gate.ts`
2. The standalone `check-no-stray-backups.ts` script has already passed its own self-test.
3. The current deprecated-content cleanup batch has finished its validation for `install-hooks`, `pre-execution`, `prompt-builder`, and `tool-tracker`.

### Hard Stop Rules

Weak models must stop immediately if any of these conditions occurs:

- A target file for the current step is already modified in `git status --short`, and that file is not explicitly listed in the parallel-safe whitelist above.
- The step requires changing `.gitignore`, `hook-layers.ts`, or `ci-semantic-validator.ts` before the serial gate is open.
- A canonical file is missing for a backup artifact that is about to be moved.
- The model is about to declare `F6` fixed before the serial-only steps and validation are complete.

### Validation For This Track

Run validation in this order:

1. Standalone scanner validation:
   - allowed paths pass
   - live-path `*.bak*` files fail
   - both tracked and ignored-untracked violations are detected
2. Parallel-stage validation:
   - non-conflicting stray backups are quarantined
   - protected files remain untouched
3. Serial-stage validation:
   - `bun .opencode/scripts/ci/check-no-stray-backups.ts` returns zero violations
   - pre-commit path blocks a synthetic stray backup
   - `bun .opencode/scripts/ci-semantic-validator.ts --range HEAD~1..HEAD` includes the stray-backup check and passes after cleanup
   - `git status` and ignored-file scans no longer show live-path stray backups outside the allowlist

### Expected Outcome

- No live source path contains a backup artifact outside the approved archive/runtime-backup locations.
- `.gitignore` no longer hides stray backups with blanket rules.
- Pre-commit and CI both block future stray-backup reintroduction.
- `team-elevation` documents describe `F5` and `F6` using the corrected historical/current state.

## Proposed Cleanup Phases

### Phase 0: Freeze the Evidence

- Save this audit as the baseline.
- Run `codegraph status` and `git diff --stat` before any cleanup PR.
- Add a small script or checklist that inventories active agents, plugin entrypoints, handler order, and legacy/deprecated exports.

### Phase 1: Fix Prompt and Documentation Drift

- Update `AGENTS.md` P0 rules to remove `Scout` and correct the dispatcher description.
- Correct the agent model table from current `opencode.json`.
- Remove `Scout` from reachable legacy profiles or replace it with `explore`.
- Update QoderWork document summaries that still mention native `Scout`.

Validation:

```bash
rg -n "Scout|scout" AGENTS.md .opencode/agents .opencode/legacy .opencode/skills
jq '.agent | keys' opencode.json
jq '.plugin' opencode.json
```

Expected result: only intentional retirement guard text remains in runtime code.

### Phase 2: Classify Handlers Before Deleting Anything

- Produce a handler manifest from `project.config.json`, dispatcher `HANDLER_MAP`, and dynamic delegate `require()` calls.
- Change comments for still-used delegate handlers from `LEGACY HANDLER` to `DELEGATE HANDLER`.
- Remove unused imports from dispatchers.
- Move true rollback-only handlers to an archive path or delete them after tests pass.

Validation:

```bash
rg -n "LEGACY HANDLER" .opencode/plugin-handlers
rg -n "require\\(\"\\.\\/|require\\('\\.\\/" .opencode/plugin-handlers
bun test .opencode/plugin-handlers
```

Expected result: no runtime-reachable handler is labelled legacy.

### Phase 3: Retire Mode-Based Enforcement Compatibility

- Replace remaining hook callers of `getEnforcementModeWithSource()`.
- Retire or migrate `pre-execution-gate.ts` before removing `getEnforcementModeCompat()`.
- Rewrite or archive `enforcement-modes-standard.md`.
- Remove deprecated mode exports only when CodeGraph callers are zero outside test/archive paths.

Validation:

```bash
codegraph callers "getEnforcementMode"
codegraph callers "getEnforcementModeWithSource"
codegraph callers "getEnforcementModeCompat"
rg -n "ENFORCEMENT_MODE|advisory|strict|locked" .opencode/service .opencode/hooks .opencode/rules
```

Expected result: active runtime branches only on per-rule disposition.

### Phase 4: Decide the DAG / Pre-Execution Script Status

- If old DAG gate is retired, move `pre-execution-gate.ts` and `pre-execution-hook.sh` to legacy/archive and remove them from `install-hooks.ts` required scripts.
- If old DAG gate is still active, document its trigger path and update startup instructions accordingly.
- Replace `@Meta-Planner` remediation text in active runtime with current agent names or compatibility-mode wording.

Validation:

```bash
rg -n "pre-execution-gate|pre-execution-hook|@Meta-Planner|Task\\.DAG" .opencode AGENTS.md
bun .opencode/scripts/install-hooks.ts --verify
bun .opencode/scripts/framework-doctor.ts
```

Expected result: no contradiction between startup docs and operational scripts.

### Phase 5: Simplify Compatibility APIs

- Replace `isWriteAllowed()` runtime caller with the active behavior/path guard contract.
- Remove `dbInsertDispatchContext()` bridge exports or make misuse fail loudly outside tests.
- Document any retained bridge exports with owner and sunset condition.

Validation:

```bash
codegraph callers "isWriteAllowed"
codegraph callers "dbInsertDispatchContext"
bun test .opencode/service
```

Expected result: deprecated APIs have zero runtime callers, or their compatibility status is explicit and tested.

### Phase 6: Remove Hidden Backup Artifacts (F5 / F6)

- Execute the integrated F5/F6 track above exactly as written.
- Start with the parallel-safe steps only.
- Do not open the serial-only steps until the serial gate conditions are all satisfied.
- Do not mark `F6` fixed until quarantine, `.gitignore`, hook integration, CI integration, and document updates are all complete.

Validation:

```bash
find . -type f \\( -name "*.bak" -o -name "*.bak-*" -o -name "*.bak-pre-*" -o -name "*.bak-phase*" \\)
bun .opencode/scripts/ci/check-no-stray-backups.ts
bun .opencode/scripts/ci-semantic-validator.ts --range HEAD~1..HEAD
git status --short --ignored
```

Expected result: no live-path stray backup survives outside the approved allowlist, and both local and CI enforcement paths block reintroduction.

## Risk Notes

- Do not bulk-delete files labelled `LEGACY HANDLER`; several are delegate-reachable from active handlers.
- Do not remove legacy role aliases until dispatch tests and any saved sessions are checked. Some historical sessions may still replay legacy role names.
- Do not remove `pre-execution-gate.ts` just because it is not in plugin order; `install-hooks.ts` and `framework-doctor.ts` still treat it as operational.
- Keep the `scout` hard-rejection guard even after removing prompt text. It prevents accidental reintroduction.
- Do not treat backup cleanup as "just delete the three files from F6". The real boundary is "no live-path stray backup outside the allowlist".

## Rollback Plan

- Each cleanup phase should be a separate commit.
- For docs/prompt drift, rollback is a direct revert.
- For handler classification, keep a manifest diff so any accidentally removed delegate can be restored.
- For compatibility APIs, first remove active callers, then remove exports in a later commit. If external usage appears, restore only the bridge export, not the old behavior.
- For Phase 6 backup cleanup, restore quarantined artifacts from `.opencode/.trash-phase0/manual-backup-quarantine/2026-07-12-f5-f6/`, then revert `.gitignore`, hook, CI, and document changes in that order.

## Done Criteria

- `rg -n "Scout|scout"` in active runtime/prompt paths returns only the explicit retirement guard or historical archive files.
- `AGENTS.md` matches `opencode.json` for agent names, model names, plugin entrypoints, and current active handler order.
- Every plugin handler has a single documented status: active-direct, active-delegate, retired-rollback, or archived.
- CodeGraph callers for deprecated APIs are zero outside tests/archive, or each remaining caller has an explicit compatibility reason.
- Serve API smoke test can dispatch `Orchestrator -> explore` and `Orchestrator -> build` without stale `Scout`, `@Meta-Planner`, or `ENFORCEMENT_MODE` guidance.
- No live-path backup artifact exists outside the approved allowlist.
- Pre-commit and CI both block new stray backup artifacts.

## Done Criteria Review (2026-07-12, current worktree)

- `Scout|scout`: not re-reviewed in full during this pass; no new contradiction found in the files inspected.
- `AGENTS.md` consistency: partially improved earlier, but this pass did not re-certify all startup claims end-to-end.
- Handler status inventory: not re-reviewed in this pass; rely on earlier audit/implementation evidence.
- Deprecated API callers: **FAIL** for current worktree because mode-compatibility exports and a live hook caller remain present.
- Serve/runtime stale guidance: **FAIL** for current worktree because active files still emit `@Meta-Planner` guidance.
- Backup-artifact remediation: **PENDING** in this consolidated blueprint; completion depends on the Phase 6 serial gate and guard rollout.
