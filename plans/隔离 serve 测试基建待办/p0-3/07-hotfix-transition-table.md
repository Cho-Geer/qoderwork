# Hotfix: TRANSITION_TABLE 与实际状态机对齐

**Phase ID**: `P0-3-HOTFIX-TT`
**Depends on**: P0-3-01（回归源）
**Outcome**: 转换表覆盖 `stopRunProcesses` 的多入口停止、`startRunProcesses` 的重启、`cleanupRun` 的失败 run 清理；execute gate 收紧；cleanup 避免 BLOCKED 自环
**Evidence level**: component
**Provenance level**: `component-only`

## 证据上限声明

本 hotfix 证据上限为 component。不签署 v2.1 ACCEPT。不要求 EV receipts、validate-audit.ts、prepare-audit.ts。

## 根因

P0-3-01 引入的 `TRANSITION_TABLE` 建模了理想化线性生命周期（CREATED->WORKTREE_READY->READY->BOOTSTRAPPED->EXECUTED->STOPPED->CLEANED），但实际代码的状态机非线性：

1. `stopRunProcesses`（process.ts:193）无条件调 `setRunState("STOPPED")`，从 READY/BOOTSTRAPPED/WORKTREE_READY 调用时全部非法
2. `startRunProcesses` 重启路径 `STOPPED -> READY`（process.ts:105）非法
3. `cleanupRun` 的 `BLOCKED -> CLEANED`（cleanup.ts:111）和 `BLOCKED -> BLOCKED`（cleanup.ts:137）非法
4. `execute.ts` gate 含不可达的 READY 死分支（bootstrapComplete=true 蕴含 BOOTSTRAPPED）
5. 所有上述路径被 fake `stopRunProcesses` 测试注入掩盖，测试全过但生产会 throw

级联失效：bootstrap 失败路径 `READY -> STOPPED` throw -> manifest PID 未清 -> cleanup `isBlockedBootstrapFailure` gate 不满足 -> run 永远无法清理。

## 修改清单

| # | 文件 | 改动 |
|---|------|------|
| 1 | `scripts/test-serve/run-context.ts` | TRANSITION_TABLE 扩展 5 条路径 |
| 2 | `scripts/test-serve/execute.ts` | gate 收紧 + reason 文案同步 |
| 3 | `scripts/test-serve/cleanup.ts` | line 137 条件调用避免 BLOCKED 自环 |
| 4 | `scripts/test-serve/__tests__/cleanup-integration.test.ts` | line 73 合法生命周期行走 |
| 5 | `scripts/test-serve/__tests__/run-context.test.ts` | 新增 BLOCKED->CLEANED + BOOTSTRAPPED->STOPPED 测试 |
| 6 | `scripts/test-serve/__tests__/process.test.ts` | 新增 STOPPED->READY 重启成功测试 |

### 转换表修改

```
WORKTREE_READY: +STOPPED  (start 超时 stop)
READY:          +STOPPED  (bootstrap 失败 stop)
BOOTSTRAPPED:   +STOPPED  (编排器 stop)
STOPPED:        +READY    (重启)
BLOCKED:        +CLEANED  (失败 run 清理)
```

### execute.ts gate 修改

```
修改前: !["READY", "BOOTSTRAPPED"].includes(manifest.status)
修改后: !["BOOTSTRAPPED"].includes(manifest.status)
```

### cleanup.ts 修改

```
修改前: setRunState(manifest, "BLOCKED");
修改后: if (manifest.status !== "BLOCKED") { setRunState(manifest, "BLOCKED"); }
```

## 验收标准

- `bun test scripts/test-serve/__tests__/` 全部 PASS
- `bun run typecheck` 无新增错误（预存 `_b1_live.ts` TS2307 除外）
- `git diff --check` exit 0
- `rg 'process\.env\.H2_AUTHORIZED\s*=' ` 无新增命中

## 不在范围

- work-one 源码
- v2.1 审计流程
- P0-3-02~06 后续 phase
