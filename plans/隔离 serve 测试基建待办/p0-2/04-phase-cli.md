# Phase PHASE-04: single-command P0-2 CLI `[ANALYSIS → VERIFICATION]`

**Phase ID**: `PHASE-04`
**Depends on**: PHASE-03
**Outcome**: `test-serve p0-2` 严格解析参数并映射 `runP02` 结果。
**Evidence level**: component

## Goal

- 仅增加 CLI 路由；不复制 coordinator、DB、进程或收敛逻辑。
- 对 CLI 所报告的负向输入或证据状态，固定使用 `FOUND`、`NOT_FOUND`、`UNAVAILABLE`；`UNAVAILABLE` 一律阻断而非视为不存在。

## Starting state and dependency

- PHASE-03 completion gate 必须有证据。
- 当前 command union/help 只列出 `p0-1b`，不存在 `p0-2`。
- 依赖缺失：`BLOCKED`，不得运行 runtime 命令。

## Local requirements

| Requirement | Condition | Required behavior | Observable result |
|---|---|---|---|
| REQ-001 | 参数非法 | coordinator 调用数为 0 | stderr JSON / exit 1 |
| REQ-002 | 参数合法 | 调用一次 `runP02` | stdout JSON / exit 0 |
| REQ-003 | coordinator 失败 | 保留 firstFailure/evidence paths | stderr JSON / exit 1 |

## Allowed files

| Exact path | Change | Exact symbol/anchor |
|---|---|---|
| `scripts/test-serve/isolated-serve.ts` | modify | command union, switch, help |
| `scripts/test-serve/__tests__/p02-cli.test.ts` | add | P02-C matrix |

## Forbidden files and behaviors

- 不修改 `p02-orchestrator.ts` contract；不增加 `--retry`,`--skip-*`,`--run-dir-a`,`--run-dir-b`、H2 或 DRY_RUN flags。
- 不使用 shell command string 或第二条生命周期命令。

## Fixed contract

- 唯一格式：`p0-2 --primary-worktree PATH --commit SHA --port-a PORT --port-b PORT --test-id ID --main-framework-db PATH`。
- 拒绝相对/不存在 path、空 testId、端口非 1–65535、端口相同、缺 flag、未知 flag。
- success JSON：`ok:true,status:"PASS",runA,runB,checks,evidencePaths.stageResults`；failure JSON：`ok:false,firstFailure,convergenceErrors,evidencePaths.stageResults`。

## Implementation steps

```text
1. 在 command union/switch/help 增加 p0-2。
2. 解析七个固定 flag 并在调用 runP02 前验证。
3. 只将 runP02 result 映射为 stdout/stderr JSON 和 exit code。
4. 用注入 runP02 spy 覆盖拒绝、成功和失败。
```

## Check Registry

| Check name | Source of truth | Read/operation | PASS | Missing/corrupt behavior | Exact failure result |
|---|---|---|---|---|---|
| `requiredArgs` | argv | parse all flags | all present | one absent | `requiredArgs` |
| `portsDistinct` | argv | numeric compare | different valid ports | equal/range failure | `portsDistinct` |
| `absoluteInputs` | fs/path | absolute/existing | both valid | invalid path | `absoluteInputs` |
| `runP02CalledOnce` | injected spy | call count | one only on valid input | zero/multiple | `runP02CalledOnce` |
| `resultMapping` | JSON output | parse stdout/stderr | exact contract | missing field | `resultMapping` |

## All-pass Fixture

| Evidence object | Creation method | Required fields/data | Why required |
|---|---|---|---|
| temp paths | fixture setup | absolute worktree/DB paths | input validation |
| runP02 spy | injected dependency | PASS result with A/B artifacts | mapping |
| captured output | CLI harness | stdout/stderr/exit | observable contract |

## Single-failure Matrix

| Test ID | Baseline | Only mutation | Expected check | Exact failedChecks/error | Other checks |
|---|---|---|---|---|---|
| P02-C-MISSING | valid argv | remove one flag | `requiredArgs` | exit 1 | runP02 0 |
| P02-C-PORT | valid argv | equal ports | `portsDistinct` | exit 1 | runP02 0 |
| P02-C-PATH | valid argv | relative DB path | `absoluteInputs` | exit 1 | runP02 0 |
| P02-C-FAIL | PASS stub | failed result | `resultMapping` | exit 1 | one call |

## Fixed verification

```bash
cd /home/zhaoge/workspace/qoderwork
/home/zhaoge/.bun/bin/bun test scripts/test-serve/__tests__/p02-cli.test.ts scripts/test-serve/__tests__/p01b-orchestrator.test.ts
/home/zhaoge/.bun/bin/bun run scripts/test-serve/isolated-serve.ts --help
git diff --check -- scripts/test-serve/isolated-serve.ts scripts/test-serve/__tests__/p02-cli.test.ts
```

- Required output/artifacts: component output, help output and scoped diff.
- On non-zero/missing evidence: `BLOCKED`; do not advance.

## Rollback/failure convergence

1. Revert only PHASE-04 allowed files.
2. Do not change coordinator behavior to make CLI tests pass.

## Phase completion gate

- [ ] PHASE-03 evidence is attached
- [ ] Invalid argv never calls coordinator
- [ ] JSON and exit mappings are exact
- [ ] P0-1B CLI regression passes
- [ ] PHASE-05 remains blocked until all boxes are checked

> 注：PHASE-04 已于 2026-07-19 实施完成（component 43 pass / 0 fail）。DONE 状态由 `00-plan-index.md` 与本次变更日志承载；本 gate 维持合同形态（与 01/02/03-phase DONE 状态下全 `[ ]` 模式一致）。evidence：6 个 P02-C 用例覆盖 requiredArgs/portsDistinct/absoluteInputs/runP02CalledOnce/resultMapping，P0-1B CLI 回归 37 pass 无回退。
