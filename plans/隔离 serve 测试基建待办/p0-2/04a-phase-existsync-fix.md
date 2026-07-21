# Phase PHASE-04a: CLI absoluteInputs existsSync Fix `[VERIFICATION]`

**Phase ID**: `PHASE-04a`
**Depends on**: PHASE-04
**Blocks**: PHASE-07
**Outcome**: `isolated-serve.ts` 的 `absoluteInputs` 验证增加 `existsSync` 检查，测试 fixture 从 `/fake/*` 改为真实临时路径，关闭 PHASE-04 审计 F-001。
**Evidence level**: component
**Provenance level**: `v2.1-required`（AGENTS.md §15 P-02 适用：实施前必须完成 Freeze Gate：scope-lock 填写 → human approval → `capture-state.ts` 捕获 pre-change receipt → 验证非空；违反则审计判定 INVALID。选择依据：PHASE-04a 为新 phase，修改生产入口文件 `isolated-serve.ts`，pre-change receipt 可捕获，不满足 invariant 18 任何 component-only 豁免条件）

## Goal

- 在 `isolated-serve.ts` 的 `absoluteInputs` 验证中增加 `existsSync` 检查，使 CLI 拒绝"相对路径"与"不存在的绝对路径"两类非法输入（满足 PHASE-04 plan Fixed contract line 42 与 Check Registry `absoluteInputs` 的 `absolute/existing` 定义）。
- 将 `p02-cli.test.ts` 的 `BASE_ARGS` fixture 从 `/fake/primary`、`/fake/framework-state.db` 改为 `mkdtempSync` 创建的真实临时路径，确保 `existsSync` 检查下正控制仍 PASS。
- 新增负向用例 `P02-C-PATH-EXIST`：不存在的绝对 DB path → exit 1，`check="absoluteInputs"`，runP02 调用 0 次。
- 不改变 `runP02` contract、success/failure JSON 映射、其他 Check Registry 项。

## Starting state and dependency

- PHASE-04 DONE（generation 3 独立复审 Accept；`audits/p0-2/2026-07-21-phase-04-cli-reimplementation-audit-g3.md`）。
- PHASE-04 审计 G1/G2/G3 标注 F-001（NON_BLOCKING_DEBT）：`absoluteInputs` 仅检查 `isAbsolute`，不检查 `existsSync`。
- 当前 `isolated-serve.ts:190-194` 验证逻辑：
  ```typescript
  if (!isAbsolute(p02PrimaryWorktree) || !isAbsolute(p02MainFrameworkDb)) {
    console.error(JSON.stringify({ ok: false, check: "absoluteInputs" }));
    process.exit(1);
    return;
  }
  ```
- 当前 `p02-cli.test.ts` `BASE_ARGS` 使用 `/fake/primary`、`/fake/framework-state.db`（不存在的绝对路径）。
- **Freeze Gate 未完成**：scope-lock PHASE-04a 未创建，pre-change receipt 未捕获。Freeze Gate 完成前禁止实施代码写入（AGENTS.md §15 P-02）。
- 缺 PHASE-04 证据或 Freeze Gate 未完成：`BLOCKED`，不得实施。

## Local requirements

| Requirement | Condition | Required behavior | Observable result |
|---|---|---|---|
| REQ-001 | 不存在 path | CLI 拒绝非存在路径，coordinator 调用 0 | stderr JSON / exit 1 |
| REQ-002 | 存在 path（正控制） | 调用一次 runP02，成功映射 | stdout JSON / exit 0 |
| REQ-003 | 行为等价 | 其他 Check Registry 项不退化 | requiredArgs/portsDistinct/runP02CalledOnce/resultMapping 全 PASS |

## Allowed files

| Exact path | Change | Exact symbol/anchor |
|---|---|---|
| `scripts/test-serve/isolated-serve.ts` | modify | `absoluteInputs` 验证块（line 190-194）增加 `existsSync` |
| `scripts/test-serve/__tests__/p02-cli.test.ts` | modify | `BASE_ARGS` fixture 改为 `mkdtempSync` 真实临时路径；新增 `P02-C-PATH-EXIST` 用例 |

## Forbidden files and behaviors

- 不修改 `p02-orchestrator.ts` contract（forbidden 区，与 PHASE-04 一致）。
- 不修改 `p02-cli-harness.ts`（测试辅助文件，保持不变；F-002 教训）。
- 不改变 `runP02` 调用参数、success/failure JSON 映射字段。
- 不增加 `--retry`/`--skip-*`/`--run-dir-a`/`--run-dir-b`/H2/DRY_RUN flags。
- 不使用 shell command string 或第二条生命周期命令。
- 不运行 runtime smoke（runtime 级由 PHASE-05 覆盖）。

## Fixed contract

- `absoluteInputs` 验证逻辑：
  ```typescript
  if (!isAbsolute(p02PrimaryWorktree) || !isAbsolute(p02MainFrameworkDb)
      || !existsSync(p02PrimaryWorktree) || !existsSync(p02MainFrameworkDb)) {
    console.error(JSON.stringify({ ok: false, check: "absoluteInputs" }));
    process.exit(1);
    return;
  }
  ```
- `p02-cli.test.ts` `BASE_ARGS` 在 `beforeEach` 中用 `mkdtempSync` 创建真实临时目录与文件，`afterEach` 清理。
- success/failure JSON 映射保持 PHASE-04 Fixed contract 不变：
  - success：`ok:true,status:"PASS",runA,runB,checks,evidencePaths.stageResults`
  - failure：`ok:false,firstFailure,convergenceErrors,evidencePaths.stageResults`

## Implementation steps

```text
1. Freeze Gate 完成后（scope-lock PHASE-04a → human approval → capture-state.ts → pre-change receipt 非空验证）：
2. 修改 isolated-serve.ts：
   - 增加 import { existsSync } from "node:fs"（如尚不存在）
   - absoluteInputs 验证块增加 !existsSync(p02PrimaryWorktree) || !existsSync(p02MainFrameworkDb)
3. 修改 p02-cli.test.ts：
   - BASE_ARGS 中 /fake/primary → tempRoot（mkdtempSync 创建）
   - BASE_ARGS 中 /fake/framework-state.db → join(tempRoot, "framework-state.db")（writeFileSync 创建空文件）
   - 调整 BASE_ARGS 构建逻辑：在 beforeEach 中重建，因 tempRoot 每次变化
   - 新增 P02-C-PATH-EXIST 用例：DB path 改为 /nonexistent/absolute/path.db → exit 1, check="absoluteInputs", runP02 0
4. 运行 Fixed verification 3 命令确认全 PASS。
```

## Check Registry

| Check name | Source of truth | Read/operation | PASS | Missing/corrupt behavior | Exact failure result |
|---|---|---|---|---|---|
| `requiredArgs` | argv | parse all flags | all present | one absent | `requiredArgs` |
| `portsDistinct` | argv | numeric compare | different valid ports | equal/range failure | `portsDistinct` |
| `absoluteInputs` | fs/path | absolute + existing | both valid | invalid path (relative OR nonexistent) | `absoluteInputs` |
| `runP02CalledOnce` | injected spy | call count | one only on valid input | zero/multiple | `runP02CalledOnce` |
| `resultMapping` | JSON output | parse stdout/stderr | exact contract | missing field | `resultMapping` |

## All-pass Fixture

| Evidence object | Creation method | Required fields/data | Why required |
|---|---|---|---|
| temp paths | mkdtempSync | absolute existing worktree/DB paths | input validation (existsSync) |
| runP02 spy | injected dependency | PASS result with A/B artifacts | mapping |
| captured output | CLI harness | stdout/stderr/exit | observable contract |

## Single-failure Matrix

| Test ID | Baseline | Only mutation | Expected check | Exact failedChecks/error | Other checks |
|---|---|---|---|---|---|
| P02-C-MISSING | valid argv | remove one flag | `requiredArgs` | exit 1 | runP02 0 |
| P02-C-PORT | valid argv | equal ports | `portsDistinct` | exit 1 | runP02 0 |
| P02-C-PATH | valid argv | relative DB path | `absoluteInputs` | exit 1 | runP02 0 |
| P02-C-PATH-EXIST | valid argv | nonexistent absolute DB path | `absoluteInputs` | exit 1 | runP02 0 |
| P02-C-FAIL | PASS stub | failed result | `resultMapping` | exit 1 | one call |

## Fixed verification

```bash
cd /home/zhaoge/workspace/qoderwork
/home/zhaoge/.bun/bin/bun test scripts/test-serve/__tests__/p02-cli.test.ts scripts/test-serve/__tests__/p01b-orchestrator.test.ts
/home/zhaoge/.bun/bin/bun run scripts/test-serve/isolated-serve.ts --help
git diff --check -- scripts/test-serve/isolated-serve.ts scripts/test-serve/__tests__/p02-cli.test.ts
```

- Required output/artifacts: component output, help output, scoped diff。
- On non-zero/missing evidence: `BLOCKED`; do not advance to PHASE-07。

## Rollback/failure convergence

1. Revert only PHASE-04a allowed files。
2. Do not change runP02 contract or other Check Registry behavior to make existsSync tests pass。

## Phase completion gate

- [ ] Freeze Gate 完成（scope-lock PHASE-04a + human approval + pre-change receipt 非空）
- [ ] PHASE-04 evidence is attached（G3 Accept）
- [ ] Nonexistent absolute path never calls coordinator（P02-C-PATH-EXIST PASS）
- [ ] Existing path positive control still passes（正控制不退化）
- [ ] JSON and exit mappings are exact（与 PHASE-04 Fixed contract 一致）
- [ ] P0-1B CLI regression passes（37 pass）
- [ ] PHASE-07 remains blocked until all boxes are checked

> 注：本 phase 关闭 PHASE-04 审计 F-001（existsSync 简化）。F-002（p02-cli-harness.ts scope 越界）不在本 phase 范围，留待 PHASE-08 文档闭环处理（更新 plan Allowed files 模板规则）。
