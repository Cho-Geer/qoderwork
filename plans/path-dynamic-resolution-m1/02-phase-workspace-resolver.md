# Phase PHASE-02: 受校验工作区解析器 `[ANALYSIS→VERIFICATION]`

**Phase ID**: `PHASE-02`
**Depends on**: PHASE-01
**Outcome**: 一个测试覆盖的路径解析模块和一个保持 `scripts/.env` 职责分离的 start-serve 调用点。
**Evidence level**: `component`
**Progression status**: `NOT_STARTED`
**Completion receipt**: `../../audits/path-dynamic-resolution-m1/evidence/progression-receipt-PHASE-02.json`

## Goal

- 以单个 fail-closed 解析器替代 M1 范围内的用户绝对路径推导，不更改 IDE 机器配置。

## Starting state and dependency

- Required status: PHASE-01 is `ACCEPTED`; its receipt and scope lock are readable; `validate-phase-progression.ts` for `PHASE-02` exits 0 before human approval submission.
- Required evidence: a human-approved PHASE-02 lock lists exactly the six paths from the index; pre-change receipt names work-one as `repository_realpath`.
- If absent: `BLOCKED`; do not create, edit, format, or test a source file.

## Local requirements

| Requirement | Condition | Required behavior | Observable result |
|---|---|---|---|
| REQ-002 | QoderWork root | derive from the resolver module location and verify its Git top level | worktree path resolves without `$HOME` |
| REQ-002 | work-one candidate | apply CLI, environment, local JSON, deprecated fallback in this order | winning source is recorded |
| REQ-002 | root validation | require an absolute real path, Git top level, and `opencode.json` | invalid candidate throws stable diagnostic |
| REQ-002 | local JSON | accept schema version 1 with platform key `linux` or `win32` | unknown keys and bad JSON fail closed |
| REQ-002 | tool override | accept an executable absolute file or a PATH command without separators | invalid tool reports its key |
| REQ-002 | launcher | preserve `--work-dir` precedence and keep `scripts/.env` secret loader separate | explicit work dir wins over resolver |

## Allowed files

| Exact path | Change | Exact symbol/anchor |
|---|---|---|
| `scripts/lib/workspace-paths.ts` | add | `resolveWorkspacePaths`, `validateWorkOneRoot`, `resolveTool` |
| `scripts/lib/__tests__/workspace-paths.test.ts` | add | PDR-C-101 and PDR-C-102 |
| `scripts/local-paths.example.json` | add | `schemaVersion`, `platforms`, `tools` |
| `.gitignore` | modify | `scripts/local-paths.json` only |
| `scripts/start-serve.ts` | modify | `resolveWorkDir` call path |
| `scripts/__tests__/start-serve-paths.test.ts` | add | explicit work-dir and separated `.env` tests |

## Forbidden files and behaviors

- Do not add `scripts/local-paths.json` to Git, change `scripts/.env` parsing, alter tracked IDE configuration, load a root `.env`, or run a serve process.
- Do not accept relative roots, a non-Git directory, an unknown JSON key, an unparseable JSON file, or an unavailable tool as success.

## Fixed contract

- `resolveWorkspacePaths(input)` returns `{ qoderworkRoot, workOneRoot, workOneSource, bunBin, codegraphBin }`; `workOneSource` is exactly `CLI`, `ENV`, `LOCAL_CONFIG`, or `DEPRECATED_DEFAULT`.
- `resolveWorkspacePaths` precedence is `input.cliWorkOneRoot`, `input.env.WORK_ONE_ROOT`, `scripts/local-paths.json.platforms[process.platform].workOneRoot`, then a resolver-module-relative legacy candidate. The first candidate that exists but fails validation throws; it does not fall through.
- `local-paths.json` and the example permit exactly `schemaVersion: 1`, `platforms.linux.workOneRoot`, `platforms.win32.workOneRoot`, `tools.bunBin`, and `tools.codegraphBin`; absent optional tool strings use PATH lookup.
- `validateWorkOneRoot` resolves symlinks, requires an absolute path and Git top level, and requires `opencode.json` at that root. `resolveTool` accepts an executable absolute file or a basename found on PATH; a string containing `/`, `\\`, or `..` is rejected unless it is an absolute executable file.
- Failures use `failedChecks` values `WORK_ONE_ROOT_INVALID`, `LOCAL_PATHS_INVALID`, `TOOL_BUN_INVALID`, or `TOOL_CODEGRAPH_INVALID`.
- Negative states: `FOUND / NOT_FOUND / UNAVAILABLE`. Missing JSON is `NOT_FOUND` only after a readable directory query; bad JSON is `UNAVAILABLE` and fails.

## Implementation steps

```text
1. Run the Phase progression admission command and confirm the human-approved lock plus receipt before opening an allowed source file.
2. Add workspace-paths.ts with the literal precedence, schema, and diagnostics above.
3. Add table-driven component tests from a temporary Git work-one fixture; create opencode.json only in the happy fixture.
4. Add the committed example, ignore only scripts/local-paths.json, and leave the local file absent.
5. Route start-serve --work-dir through the resolver while retaining its explicit argument priority and its scripts/.env loader.
6. Run the fixed verification; on any failure, retain the worktree and mark the phase BLOCKED.
```

## Check Registry

| Check name | Source of truth | Read/operation | PASS | Missing/corrupt behavior | Exact failure result |
|---|---|---|---|---|---|
| PDR-ROOT | temporary Git fixture | resolve each precedence source | exact root and source label | unavailable fixture | `WORK_ONE_ROOT_INVALID` |
| PDR-JSON | temporary JSON | parse and key validation | literal schema accepted | bad JSON/unknown key | `LOCAL_PATHS_INVALID` |
| PDR-TOOL | controlled executable fixture | resolve Bun and CodeGraph | executable or PATH basename | missing/nonexecutable tool | tool-specific diagnostic |
| PDR-LAUNCHER | start-serve unit fixture | pass `--work-dir` and env | CLI root wins; `.env` remains separate | absent fixture | `WORK_ONE_ROOT_INVALID` |

## All-pass Fixture

| Evidence object | Creation method | Required fields/data | Why required |
|---|---|---|---|
| work-one fixture | `mkdtemp` + `git init` | Git top level and `opencode.json` | validates roots without real work-one mutation |
| local JSON fixture | write JSON under temporary resolver root | schema version, current platform root, empty tools | tests local configuration path |
| tool fixture | executable temporary file plus controlled PATH | one Bun and one CodeGraph name | tests executable checks |
| launcher input | explicit `--work-dir` and `scripts/.env` fixture | distinct values | proves responsibility separation |

## Single-failure Matrix

| Test ID | Baseline | Only mutation | Expected check | Exact failedChecks/error | Other checks |
|---|---|---|---|---|---|
| PDR-C-101 | valid root fixture | make ENV root relative | PDR-ROOT | `WORK_ONE_ROOT_INVALID` | PDR-JSON remains true |
| PDR-C-102 | valid JSON | add `tools.extra` | PDR-JSON | `LOCAL_PATHS_INVALID` | PDR-ROOT remains true |
| PDR-C-103 | executable Bun fixture | remove execute bit | PDR-TOOL | `TOOL_BUN_INVALID` | PDR-ROOT remains true |
| PDR-C-104 | explicit work dir | remove fixture `opencode.json` | PDR-LAUNCHER | `WORK_ONE_ROOT_INVALID` | PDR-JSON remains true |

## Fixed verification

```bash
cd /home/zhaoge/workspace/qoderwork/.worktrees/check-plan
/home/zhaoge/.bun/bin/bun run .agents/skills/deterministic-implementation-planning/scripts/validate-phase-progression.ts plans/path-dynamic-resolution-m1 PHASE-02
/home/zhaoge/.bun/bin/bun test scripts/lib/__tests__/workspace-paths.test.ts scripts/__tests__/start-serve-paths.test.ts
/home/zhaoge/.bun/bin/bun run typecheck
```

- Required output/artifacts: component test report and a typecheck result; no serve PID, worktree, or live session is created.
- On nonzero output, a receipt mismatch, or a changed forbidden file: `BLOCKED`; preserve diagnostics; do not advance.

## Rollback/failure convergence

1. Revert only the six PHASE-02 files after preserving component output and audit artifacts.
2. Do not add a permissive fallback, reclassify `UNAVAILABLE` as absence, or modify a PHASE-03 file.

## Phase completion gate

- [ ] Allowed-file diff only
- [ ] PHASE-02 admission validator exits 0 before its human approval submission
- [ ] Resolver precedence and literal schema match this contract
- [ ] Each registry check has an all-pass fixture and one isolated mutation
- [ ] Component tests and typecheck produce retained diagnostics
- [ ] Downstream Phase remains blocked until every box is checked
