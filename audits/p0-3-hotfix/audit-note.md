# P0-3-HOTFIX-TT Audit Note

**证据上限**: component
**Provenance**: component-only（不签署 v2.1 ACCEPT）

## 验证结果

| 检查项 | 结果 | 说明 |
|--------|------|------|
| bun test (6 component files) | 38 pass / 0 fail | 含 3 个新增 hotfix 测试 |
| bun test (全量 17 files) | 303 pass / 2 fail | 2 fail 为预存 runtime 测试（需 P0_1B_PORT） |
| bun run typecheck | 1 error (预存) | scripts/_b1_live.ts TS2307，非本次引入 |
| git diff --check | exit 0 | 修复 trailing whitespace 后通过 |
| rg H2_AUTHORIZED | 1 hit (预存) | run-context.ts:168 比较 `===`，非赋值 |

## 改动文件

| 文件 | 改动 |
|------|------|
| run-context.ts | TRANSITION_TABLE 扩展 5 条路径 |
| execute.ts | gate 收紧：删除 READY 死分支 |
| cleanup.ts | 条件调用避免 BLOCKED 自环 |
| cleanup-integration.test.ts | line 73 合法生命周期行走 |
| run-context.test.ts | +2 测试：BLOCKED->CLEANED, BOOTSTRAPPED->STOPPED |
| process.test.ts | +1 测试：STOPPED->READY 重启 |

## 预存条件（非本次引入）

- typecheck: `scripts/_b1_live.ts` TS2307（missing module）
- rg: `run-context.ts:168` H2_AUTHORIZED 比较（非赋值）
- 2 个 runtime 测试需 `P0_1B_PORT`
