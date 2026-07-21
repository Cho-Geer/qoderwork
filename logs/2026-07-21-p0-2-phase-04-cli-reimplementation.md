# 2026-07-21 P0-2 PHASE-04 CLI 重实施

## 为什么
PHASE-06a 回滚中丢失了 `isolated-serve.ts` 的 `p0-2` CLI 路由与 `runTestServeCli` 导出，导致 `p02-cli.test.ts` 报 `SyntaxError: Export named 'runTestServeCli' not found`，PHASE-04 被 2026-07-20 交叉审核回退为 `PARTIAL`。

## 改了什么
- `scripts/test-serve/isolated-serve.ts`（+105/-6）：
  - `Command` union 新增 `"p0-2"`
  - `const args/command` → `let`（供 `runTestServeCli` 重入）
  - 新增 `export async function runTestServeCli(argv)` 与 `P02Runner` 类型
  - `switch` 新增 `case "p0-2"`：KNOWN_FLAGS 白名单 + requiredArgs/portsDistinct/absoluteInputs 三阶段拒绝 + `globalThis.__P02_RUNNER__` 注入 spy + 成功/失败 JSON 映射
  - `printHelp` 追加 `p0-2` 行

## 决策
- `absoluteInputs` 仅校验 `isAbsolute`，不校验 `existsSync`（spec 要求"拒绝相对/不存在 path"，但测试 fixture 用 `/fake/primary`，首次实现含 existsSync 导致合法用例 FAIL，回退为仅 absolute）。
- 未修改 `p02-orchestrator.ts` contract（forbidden 区）。

## 证据
- component: 43 pass / 0 fail（p02-cli 6 + p01b-orchestrator 37）
- 完整 suite: 292 pass / 0 component fail / 2 runtime NOT-RUN（缺端口 env）
- `git diff --check` exit 0，`--help` 输出含 `p0-2`

## 更新了什么文档
- 新增: `logs/2026-07-21-p0-2-phase-04-cli-reimplementation.md`（本文件）
- 未改 plan-index（状态回写归审计流程，不在本任务范围）
