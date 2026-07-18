# Phase PHASE-07: regression and static closure gate `[VERIFICATION]`

**Phase ID**: `PHASE-07`
**Depends on**: PHASE-06
**Outcome**: P0-2 changes pass scoped regression and expose any root typecheck blocker honestly.
**Evidence level**: component

## Goal

- 运行回归、静态禁用模式和根 typecheck；不将范围外 debt 写成 PASS。

## Starting state and dependency

- PHASE-06 两组 runtime-smoke 证据必须可读。
- 当前根 typecheck exit 1，错误位于 work-one 和旧脚本；若仍失败，本 Phase 为 `BLOCKED`。

## Local requirements

| Requirement | Condition | Required behavior | Observable result |
|---|---|---|---|
| REQ-001 | regressions | P0 test suite 0 fail | test output |
| REQ-002 | static safety | 禁用模式不在活跃实现 | scoped `rg` result |
| REQ-003 | typecheck | root command exit 0 | closure eligibility |

## Allowed files

| Exact path | Change | Exact symbol/anchor |
|---|---|---|
| `scripts/test-serve/__tests__/` | modify only if regression defect is P0-2 owned | failing test | regression repair |
| `scripts/test-serve/` | modify only if regression defect is P0-2 owned | failing symbol | regression repair |

## Forbidden files and behaviors

- 不修复 work-one 或无关脚本 typecheck 债务；不删除断言；不将 `rg` 禁用说明文本误判为活跃实现。

## Fixed contract

- test command 只报告 component 结果；root typecheck 非零即 `BLOCKED-BY-ROOT-TYPECHECK`。
- `oracle.ts` 和 `verify-p02.ts` 的 SQL 仅允许 readonly `SELECT`；任何写 SQL 为 FAIL。
- 活跃 runner/skill 不得使用固定 4097、固定 SSE 文件、裸 serve、`pkill` 或 H2 自授权。

## Implementation steps

```text
1. 运行固定测试集并保存输出。
2. 运行 root typecheck，不过滤错误。
3. 对活跃实现路径运行固定 rg 检查并人工区分拒绝文案。
4. 仅修复可归因于 P0-2 的失败；其余保留 BLOCKED。
```

## Check Registry

| Check name | Source of truth | Read/operation | PASS | Missing/corrupt behavior | Exact failure result |
|---|---|---|---|---|---|
| `p02Regression` | Bun tests | fixed suite | 0 fail | non-zero | `p02Regression` |
| `rootTypecheck` | root command | exit code | 0 | non-zero | `rootTypecheck` |
| `forbiddenRuntimePattern` | active source | rg + review | no active match | active match | `forbiddenRuntimePattern` |
| `readonlyOracle` | oracle/verifier source | rg SQL verbs | no writes | write verb | `readonlyOracle` |

## All-pass Fixture

| Evidence object | Creation method | Required fields/data | Why required |
|---|---|---|---|
| test output | fixed Bun suite | 0 fail summary | regression |
| typecheck output | root command | exit 0 | closure gate |
| rg outputs | fixed source paths | reviewed matches | safety evidence |

## Single-failure Matrix

| Test ID | Baseline | Only mutation | Expected check | Exact failedChecks/error | Other checks |
|---|---|---|---|---|---|
| P02-G-TEST | green suite | one P0-2 assertion fails | `p02Regression` | non-zero | retained output |
| P02-G-TSC | root clean | one type error | `rootTypecheck` | non-zero | no DONE |
| P02-G-PATTERN | safe source | active fixed port | `forbiddenRuntimePattern` | exact path | no closure |

## Fixed verification

```bash
cd /home/zhaoge/workspace/qoderwork
/home/zhaoge/.bun/bin/bun test scripts/test-serve/__tests__/oracle.test.ts scripts/test-serve/__tests__/verify-p01b.test.ts scripts/test-serve/__tests__/verify-p02.test.ts scripts/test-serve/__tests__/p02-orchestrator.test.ts scripts/test-serve/__tests__/p02-cli.test.ts scripts/test-serve/__tests__/p02-runtime.test.ts
/home/zhaoge/.bun/bin/bun run typecheck
git diff --check
rg -n '4097|/tmp/sse-events.jsonl|pkill|H2_AUTHORIZED=true' scripts/test-serve .agents/skills/isolated-serve-test .qoder/skills/isolated-serve-test .trae/skills/isolated-serve-test .workbuddy/skills/isolated-serve-test
```

- Required output/artifacts: command output and reviewed matches.
- On non-zero/missing evidence: `BLOCKED`; do not advance.

## Rollback/failure convergence

1. Revert only P0-2-owned repair files.
2. Preserve typecheck and rg output; do not suppress failures.

## Phase completion gate

- [ ] PHASE-06 runtime evidence is attached
- [ ] fixed regression suite is 0 fail
- [ ] root typecheck exits 0
- [ ] static safety checks have no active implementation match
- [ ] PHASE-08 remains blocked until all boxes are checked
