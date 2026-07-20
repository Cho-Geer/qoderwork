# Phase PHASE-06a: Circular Dependency + TDZ Fix `[VERIFICATION]`

**Phase ID**: `PHASE-06a`
**Depends on**: PHASE-05
**Blocks**: PHASE-06
**Outcome**: 提取 cleanupRun 到独立 `cleanup.ts`，打破 isolated-serve ↔ p02-orchestrator 循环依赖，修复 import.meta.main TDZ，恢复 CLI p0-2 命令可用性。
**Evidence level**: component
**Provenance level**: `v2.1-required`（AGENTS.md §15 P-02 适用：scope-lock → human approval → capture-state → pre-change receipt）

## Goal

- 从 `isolated-serve.ts` 提取 `cleanupRun` 到新文件 `cleanup.ts`，打破循环依赖（isolated-serve → p02-orchestrator → isolated-serve）。
- 将 `import.meta.main` 入口移到文件末尾，修复 P02_KNOWN_FLAGS TDZ（`Cannot access 'P02_KNOWN_FLAGS' before initialization`）。
- 更新 `p02-orchestrator.ts` 和 `p01b-orchestrator.ts` 的 `cleanupRun` import 来源从 `./isolated-serve` 改为 `./cleanup`。
- 保留 `isolated-serve.ts` 中 `export { cleanupRun }` re-export 以兼容历史测试导入路径（backward compatibility）。
- 确认 CLI `p0-2` 命令不再报 TDZ 错误（--help 能正常返回）。

## Starting state and dependency

- PHASE-05 audit-2 ACCEPT（runtime-smoke 级证据；5 allowed_files）。
- PHASE-06 audit-1 INVALID：发现 CLI 因循环依赖/TDZ 实际不可用；pre-fix 证据为 `bun run isolated-serve.ts p0-2 --help → "Cannot access 'P02_KNOWN_FLAGS' before initialization"`。
- 已选择性回退 4 个文件到 post-PHASE-05 状态（cleanup.ts 已删除、imports 已恢复、inline cleanupRun 已恢复、import.meta.main 已置于顶部制造 TDZ）。

## Local requirements

| Requirement | Condition | Required behavior | Observable result |
|---|---|---|---|
| REQ-001 | 循环依赖打破 | isolated-serve 不再 import cleanupRun from itself (indirectly) | import graph has no cycle through cleanupRun |
| REQ-002 | TDZ 修复 | import.meta.main 在所有模块级 const 初始化之后 | CLI `p0-2 --help` 不报错，返回 help 文本 |
| REQ-003 | 行为等价 | cleanupRun 逻辑与内联版本完全一致 | 组件测试 cleanup 相关用例全部 PASS |
| REQ-004 | backward compat | 历史 import { cleanupRun } from "./isolated-serve" 仍可用 | re-export 存在，p01b-orchestrator 通过 cleanupRun 路径解析 |

## Allowed files

| Exact path | Change | Exact symbol/anchor |
|---|---|---|
| `scripts/test-serve/cleanup.ts` | add | module (cleanupRun 完整提取) |
| `scripts/test-serve/isolated-serve.ts` | modify | 移除外联 cleanupRun；增加 import + re-export from ./cleanup；移动 import.meta.main 到文件末尾 |
| `scripts/test-serve/p02-orchestrator.ts` | modify | import cleanupRun from ./cleanup |
| `scripts/test-serve/p01b-orchestrator.ts` | modify | import cleanupRun from ./cleanup |

## Forbidden files and behaviors

- 不修改 `verify-p02.ts`、`verify-p01b.ts`、`process.ts`、`run-context.ts`、`bootstrap.ts`、`execute.ts`、`types.ts`、`p02-sentinel.ts`。
- 不改变 cleanupRun 的任何行为逻辑（错误处理、fail-closed、spawn 选项、返回值形状）。
- 不添加新功能、不重构其他函数。
- 不运行 runtime smoke（这是 PHASE-06 的工作）。
- 不设置 H2_AUTHORIZED。

## Fixed contract

- 修复后 CLI `p0-2` 命令至少能解析 args（--help 正常输出），不再抛 TDZ 错误。
- 组件测试 suite 中所有 cleanup 相关测试通过（p02-orchestrator cleanup stages、create-failure-cleanup、p01b cleanup verifier 等）。
- bun:test 全量测试（bun test scripts/test-serve/__tests__，不含需显式端口的 runtime 测试）应 PASS / 0 fail 于 component 子集。

## Implementation steps

```text
1. Freeze Gate 完成后（scope-lock PHASE-06a → human approval → capture-state.ts → pre-change receipt 非空验证）：
2. 新增 scripts/test-serve/cleanup.ts，拷贝 isolated-serve.ts 中 cleanupRun 函数全文，补充顶部 import（existsSync/rmSync/writeFileSync from node:fs；archiveFrameworkLogs/readRunManifest/setRunState/writeRunManifest from ./run-context；CleanupResult/GitWorktreeRemoveSpawnResult from ./types）。
3. 修改 isolated-serve.ts：
   - 增加 import { isAbsolute } from "node:path"（parseP02Args 需要）
   - 增加 import { cleanupRun } from "./cleanup"
   - 增加 import { archiveFrameworkLogs, setRunState, writeRunManifest } 的移除（已移到 cleanup.ts）
   - 删除内联 cleanupRun 函数体，替换为 export { cleanupRun } from "./cleanup" re-export
   - 删除顶部 import.meta.main 块，移到文件末尾（在 P02_KNOWN_FLAGS、parseP02Args、getP02Runner 等所有模块级 const 之后）
4. 修改 p02-orchestrator.ts：import cleanupRun from "./cleanup"
5. 修改 p01b-orchestrator.ts：import cleanupRun from "./cleanup"（isolated-serve re-export 作为兼容层，不再直接依赖）
6. 运行 bun test scripts/test-serve/__tests__（component 子集，不含需端口的 runtime 测试），确认 cleanup 相关测试 PASS。
7. 运行 bun run scripts/test-serve/isolated-serve.ts p0-2 --help 确认不再报 TDZ（应返回 missing required args 错误或 help，而非 ReferenceError）。
8. 将证据交给审计；不推进 PHASE-07。
```

## Check Registry

| Check name | Source of truth | Read/operation | PASS | Missing/corrupt behavior | Exact failure result |
|---|---|---|---|---|---|
| `noCycle` | import graph | static inspection | no cycle through cleanupRun | cycle exists | `circularDependency` |
| `cliNoTDZ` | CLI invocation | `bun run isolated-serve.ts p0-2 --help` | exit 0 or clean error, no ReferenceError | ReferenceError thrown | `tdzError` |
| `cleanupBehavior` | bun:test | component tests for cleanup paths | all pass | any fail | `cleanupBehavior` |
| `backwardCompat` | TypeScript compilation | `bun run typecheck` on affected files | no type errors in imports | import resolution fail | `backwardCompat` |

## All-pass Fixture

| Evidence object | Creation method | Required fields/data | Why required |
|---|---|---|---|
| Freeze Gate receipts | capture-state.ts | pre-change-PHASE-06a.json | P-02 compliance |
| CLI output | real command | help text or clean arg error, no TDZ | proves CLI usable |
| Component test output | bun test | cleanup-related tests PASS | behavior equivalence |
| File diff | git diff | 4 files changed per Allowed files table | scope control |

## Single-failure Matrix

| Test ID | Baseline | Only mutation | Expected check | Exact failedChecks/error | Other checks |
|---|---|---|---|---|---|
| P0-6a-CYCLE | fixed graph | re-add circular import | `noCycle` | cycle detected | CLI TDZ observed |
| P0-6a-TDZ | fixed entry | move import.meta.main back to top | `cliNoTDZ` | ReferenceError: P02_KNOWN_FLAGS | help text unavailable |
| P0-6a-BEHAVIOR | fixed cleanup | alter rmError logic | `cleanupBehavior` | component test FAIL | behavior drift |

## Fixed verification

```bash
cd /home/zhaoge/workspace/qoderwork
# Static check: no circular import
node -e "const m = await import('./scripts/test-serve/isolated-serve.ts')" 2>&1 | grep -i 'circular' && echo "CYCLE_DETECTED" || echo "NO_CIRCLE_ERROR"

# CLI check: no TDZ
XDG_STATE_HOME=/home/zhaoge/.local/state/qoderwork /home/zhaoge/.bun/bin/bun run scripts/test-serve/isolated-serve.ts p0-2 --help 2>&1 | head -5

# Component test check
cd /home/zhaoge/workspace/qoderwork
/home/zhaoge/.bun/bin/bun test scripts/test-serve/__tests__/p02-orchestrator.test.ts scripts/test-serve/__tests__/run-context.test.ts scripts/test-serve/__tests__/process.test.ts 2>&1 | tail -10
```

- Required output/artifacts: CLI output without ReferenceError; component tests all PASS.
- On TDZ/ReferenceError or component failure: `BLOCKED`; preserve evidence; do not advance to PHASE-06.

## Rollback/failure convergence

1. Do not issue additional code changes beyond Allowed files.
2. If any component test fails, do not modify tests; revert to pre-PHASE-06a state via git checkout (pre-change receipt provides baseline hash).

## Phase completion gate

- [ ] Freeze Gate 完成（scope-lock PHASE-06a + human approval + pre-change receipt 非空）
- [ ] cleanup.ts 新增，cleanupRun 逻辑与内联版本逐行一致
- [ ] isolated-serve.ts 内联 cleanupRun 已移除，re-export 从 ./cleanup 存在，import.meta.main 在文件末尾
- [ ] p02-orchestrator.ts + p01b-orchestrator.ts import 来源改为 ./cleanup
- [ ] CLI `p0-2 --help` 不报 ReferenceError/TDZ
- [ ] component 测试 cleanup 相关全部 PASS
- [ ] PHASE-06 仍保持 BLOCKED，等待 PHASE-06a 审计 ACCEPT 后再走 PHASE-06 Freeze Gate
