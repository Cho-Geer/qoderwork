# Phase PHASE-06: independent CLI-only dual-run smoke `[VERIFICATION]`

**Phase ID**: `PHASE-06`
**Depends on**: PHASE-05
**Outcome**: 第二组 reviewer 端口上的 CLI-only runtime-smoke 独立通过。
**Evidence level**: runtime-smoke

## Goal

- 用与 PHASE-05 不同的两端口只运行一次 CLI，证明入口与测试 harness 独立有效。
- 对复核中任何目标不存在的判断，固定记录 `FOUND`、`NOT_FOUND`、`UNAVAILABLE`；未读到证据为 `UNAVAILABLE`。

## Starting state and dependency

- PHASE-05 gate 必须通过，reviewer 已提供新的两个端口。
- 未提供第二组端口：`BLOCKED-BY-REVIEWER-PORTS`，不执行任何 CLI。

## Local requirements

| Requirement | Condition | Required behavior | Observable result |
|---|---|---|---|
| REQ-001 | CLI input | 使用新双端口 | command executes once |
| REQ-002 | CLI result | 输出 PASS JSON | exit 0 |
| REQ-003 | evidence | A/B artifacts 可读 | independent run IDs |

## Allowed files

| Exact path | Change | Exact symbol/anchor |
|---|---|---|
| `plans/隔离 serve 测试基建待办/p0-2/06-phase-cli-smoke.md` | execute only | fixed command | runtime evidence |

## Forbidden files and behaviors

- 不修改代码；不复用 PHASE-05 端口；不设置 H2；不在失败后重试；不手工编辑 manifest。

## Fixed contract

- 使用 `test-serve p0-2`、primary worktree `/home/zhaoge/workspace/opencode/work-one`、当前 commit 和 main framework DB。
- PASS：exit 0、`ok:true,status:"PASS"`、16 stages 全 ok、五组 checks 全真、A/B artifacts 可读。
- FAIL：保留 stdout/stderr 和 run paths，状态 `BLOCKED`。

## Implementation steps

```text
1. 记录 reviewer 第二组端口和当前 commit。
2. 仅执行一次固定 CLI。
3. 解析 JSON 并读取 A/B manifest、stage results、cleanup reports。
4. 将 run IDs/paths 交给 PHASE-07；不改状态为 DONE。
```

## Check Registry

| Check name | Source of truth | Read/operation | PASS | Missing/corrupt behavior | Exact failure result |
|---|---|---|---|---|---|
| `cliExit` | process exit | invoke once | 0 | non-zero | `cliExit` |
| `cliPayload` | stdout JSON | parse fields | PASS contract | missing/malformed | `cliPayload` |
| `independentEvidence` | A/B paths | read manifests | new run IDs readable | missing/reused | `independentEvidence` |

## All-pass Fixture

| Evidence object | Creation method | Required fields/data | Why required |
|---|---|---|---|
| reviewer ports | reviewer input | pair distinct from PHASE-05 | independent smoke |
| CLI output | real command | A/B paths and checks | result proof |
| A/B evidence | persistent state | manifests/stages/reports | audit trail |

## Single-failure Matrix

| Test ID | Baseline | Only mutation | Expected check | Exact failedChecks/error | Other checks |
|---|---|---|---|---|---|
| P02-S-PORTS | ready state | ports absent | `cliExit` | BLOCKED | command 0 |
| P02-S-PAYLOAD | successful process | malformed stdout | `cliPayload` | exact failure | artifacts retained |

## Fixed verification

```bash
cd /home/zhaoge/workspace/qoderwork
XDG_STATE_HOME=/home/zhaoge/.local/state/qoderwork /home/zhaoge/.bun/bin/bun run scripts/test-serve/isolated-serve.ts p0-2 --primary-worktree /home/zhaoge/workspace/opencode/work-one --commit "$COMMIT" --port-a "$P0_2_PORT_A" --port-b "$P0_2_PORT_B" --test-id P0-2-CLI-SMOKE --main-framework-db /home/zhaoge/workspace/opencode/work-one/.opencode/state/framework-state.db
```

- Required output/artifacts: stdout/stderr and absolute A/B run paths.
- On non-zero/missing evidence: `BLOCKED`; preserve evidence; do not advance.

## Rollback/failure convergence

1. Do not issue a second CLI run.
2. Do not delete failed run artifacts.

## Phase completion gate

- [x] PHASE-05 evidence is attached
- [x] second reviewer port pair is distinct
- [x] CLI result and A/B evidence are readable
- [x] runtime-smoke is not inferred from component evidence
- [x] PHASE-07 remains blocked until all boxes are checked
