# Phase PHASE-03: test-serve 根路径与导入迁移 `[ANALYSIS→VERIFICATION]`

**Phase ID**: `PHASE-03`
**Depends on**: PHASE-02
**Outcome**: test-serve 的默认 primary worktree、SSE daemon 资产路径和 bootstrap 动态 import 不再依赖用户绝对路径。
**Evidence level**: `component`
**Progression status**: `ACCEPTED`
**Completion receipt**: `../../audits/path-dynamic-resolution-m1/evidence/progression-receipt-PHASE-03.json`

## Goal

- 保持现有 CLI 覆盖顺序和隔离 worktree 语义，同时把三个 M1 路径消费点接入受校验根来源。

## Starting state and dependency

- Required status: PHASE-02 is `ACCEPTED`; PHASE-03 has a human-approved scope lock and a nonempty pre-change receipt; progression admission for `PHASE-03` exits 0 before approval submission.
- Required evidence: PHASE-02 component report and typecheck result remain readable; `scripts/lib/workspace-paths.ts` exports the PHASE-02 contract unchanged.
- If absent: `BLOCKED`; do not change a test-serve source or test file.

## Local requirements

| Requirement | Condition | Required behavior | Observable result |
|---|---|---|---|
| REQ-003 | no explicit primary root | `getDefaultPrimaryWorktree()` delegates to the resolver | resolved work-one root is returned |
| REQ-003 | CLI root provided | `--from` and `--primary-worktree` keep precedence over the default | supplied path reaches create/snapshot input |
| REQ-003 | SSE daemon launch | derive source with `resolve(import.meta.dir, "..", "sse-daemon.ts")` | path belongs to calling QoderWork worktree |
| REQ-003 | SSE source missing | fail before spawn and name the stable diagnostic | no serve or SSE child starts |
| REQ-003 | bootstrap privilege import | use `pathToFileURL(resolvedPrivilegePath).href` | isolated worktree module loads |
| REQ-003 | shared caller coverage | exercise isolated-serve default path | CLI consumer receives resolver result |
| REQ-003 | live caller exception | `_b_pt_wm_00r2_live.ts` remains unexecuted | exception records reviewer-only live boundary |

## Allowed files

| Exact path | Change | Exact symbol/anchor |
|---|---|---|
| `scripts/test-serve/run-context.ts` | modify | `getDefaultPrimaryWorktree` |
| `scripts/test-serve/__tests__/run-context.test.ts` | modify | default root regression |
| `scripts/test-serve/process.ts` | modify | `getSseDaemonPath` and spawn path |
| `scripts/test-serve/__tests__/process.test.ts` | modify | absent and module-derived daemon tests |
| `scripts/test-serve/bootstrap.ts` | modify | privilege dynamic import |
| `scripts/test-serve/__tests__/bootstrap-import-source.test.ts` | modify | file-URL import assertion |
| `scripts/test-serve/isolated-serve.ts` | modify | exported argument-resolution seam |
| `scripts/test-serve/__tests__/isolated-serve-paths.test.ts` | add | CLI override and default-root tests |

## Forbidden files and behaviors

- Do not change test-serve state transitions, port reservation, process identity logic, manifest schema, work-one code, or `_b_pt_wm_00r2_live.ts`.
- Do not derive `SSE_DAEMON_PATH` from `manifest.paths.worktreeDir`, start a bare serve, bind fixed port `4097`, or run the reviewer-gated live caller.

## Fixed contract

- `getDefaultPrimaryWorktree()` has no caller-supplied path parameter and returns `resolveWorkspacePaths({}).workOneRoot`; `isolated-serve.ts` retains `getArg("--from") || getDefaultPrimaryWorktree()` and `getArg("--primary-worktree") || getDefaultPrimaryWorktree()`.
- `getSseDaemonPath()` is defined in `process.ts`, calculates `resolve(import.meta.dir, "..", "sse-daemon.ts")`, verifies a readable regular file, and throws `SSE_DAEMON_PATH_INVALID` before `spawn` on failure.
- Bootstrap constructs `resolvedPrivilegePath = resolve(manifest.paths.worktreeDir, ".opencode", "service", "dispatch", "privilege.ts")` and calls `await import(pathToFileURL(resolvedPrivilegePath).href)`.
- The test seam may expose only parsed CLI root selection. It must not expose a spawn, authorization, or manifest-writing shortcut.
- `scripts/_b_pt_wm_00r2_live.ts` has no component-safe caller test because it is reviewer-gated live workflow. Its allowed exception is a static source assertion plus the Phase-04 authorized runtime gate; no component PASS claims it ran.
- Negative states: `FOUND / NOT_FOUND / UNAVAILABLE`. Missing daemon file is `NOT_FOUND` after readable directory inspection; failed inspection is `UNAVAILABLE` and fails.

## Implementation steps

```text
1. Run PHASE-03 progression admission and verify its approved lock and receipt.
2. Replace only getDefaultPrimaryWorktree with the resolver call; add a direct component test using an ENV fixture.
3. Add getSseDaemonPath in process.ts and test a module-derived fixture plus one missing-file mutation before any spawn assertion.
4. Convert bootstrap to a file URL import and update the source-isolation test to inspect the literal pathToFileURL contract.
5. Add the isolated-serve argument seam and test both explicit CLI roots and the resolver default.
6. Record the live-caller exception in the phase audit; run fixed component commands and typecheck.
```

## Check Registry

| Check name | Source of truth | Read/operation | PASS | Missing/corrupt behavior | Exact failure result |
|---|---|---|---|---|---|
| PDR-PRIMARY | resolver ENV fixture | call default root function | returns fixture root | root resolution unavailable | `WORK_ONE_ROOT_INVALID` |
| PDR-CLI | isolated-serve seam | parse `--from` and `--primary-worktree` | explicit value wins | malformed root fixture | `WORK_ONE_ROOT_INVALID` |
| PDR-SSE | process module fixture | resolve and inspect daemon path | regular file under QoderWork module root | unavailable inspection | `SSE_DAEMON_PATH_INVALID` |
| PDR-SSE-NEG | missing daemon mutation | call path resolver before spawn | throws diagnostic; spawn count is zero | unreadable directory | `SSE_DAEMON_PATH_INVALID` |
| PDR-IMPORT | isolated privilege fixture | execute bootstrap import | marker comes from isolated tree | import read failure | `PRIVILEGE_IMPORT_INVALID` |
| PDR-LIVE-EXCEPTION | static caller inspection | assert exception record text | no live execution claim | missing record | `LIVE_CALLER_EXCEPTION_MISSING` |

## All-pass Fixture

| Evidence object | Creation method | Required fields/data | Why required |
|---|---|---|---|
| resolver root | PHASE-02 test helper | Git fixture and `opencode.json` | default root is valid |
| daemon file | temporary module-root fixture | `sse-daemon.ts` regular file | proves source derivation |
| isolated privilege module | temporary worktree fixture | marker plus exported grant functions | proves import origin |
| CLI argument set | parsed `--from` and `--primary-worktree` arrays | two distinct fixture roots | proves override precedence |

## Single-failure Matrix

| Test ID | Baseline | Only mutation | Expected check | Exact failedChecks/error | Other checks |
|---|---|---|---|---|---|
| PDR-C-201 | valid resolver root | make ENV root relative | PDR-PRIMARY | `WORK_ONE_ROOT_INVALID` | PDR-SSE remains true |
| PDR-C-202 | daemon fixture | remove `sse-daemon.ts` | PDR-SSE-NEG | `SSE_DAEMON_PATH_INVALID` | PDR-IMPORT remains true |
| PDR-C-203 | isolated module | change marker file path to main root | PDR-IMPORT | `PRIVILEGE_IMPORT_INVALID` | PDR-CLI remains true |
| PDR-C-204 | documented exception | remove exception record | PDR-LIVE-EXCEPTION | `LIVE_CALLER_EXCEPTION_MISSING` | PDR-PRIMARY remains true |

## Fixed verification

```bash
cd /home/zhaoge/workspace/qoderwork/.worktrees/check-plan
/home/zhaoge/.bun/bin/bun run .agents/skills/deterministic-implementation-planning/scripts/validate-phase-progression.ts plans/path-dynamic-resolution-m1 PHASE-03
/home/zhaoge/.bun/bin/bun test scripts/test-serve/__tests__/run-context.test.ts scripts/test-serve/__tests__/process.test.ts scripts/test-serve/__tests__/bootstrap-import-source.test.ts scripts/test-serve/__tests__/isolated-serve-paths.test.ts
/home/zhaoge/.bun/bin/bun run typecheck
rg -n 'getDefaultPrimaryWorktree' scripts/_b_pt_wm_00r2_live.ts
```

- Required output/artifacts: retained component reports and exception audit note. These commands produce component evidence; they do not prove runtime-smoke or live-E2E.
- On nonzero output, forbidden-file drift, missing exception note, or a receipt mismatch: `BLOCKED`; preserve diagnostics; do not advance.

## Rollback/failure convergence

1. Revert only the eight listed paths after recording the component output and audit evidence.
2. Do not weaken process identity checks, fake a daemon success, add a raw absolute import, or edit the live caller to make a component test pass.

## Phase completion gate

- [X] Allowed-file diff only
- [X] PHASE-03 admission validator exits 0 before its human approval submission
- [X] Primary root, SSE source, and file-URL import meet the literal contract
- [X] Each registry check has an all-pass fixture and one isolated mutation
- [X] Component tests and typecheck produce retained diagnostics
- [X] Downstream Phase remains blocked until every box is checked
