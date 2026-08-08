# 2026-08-08 PHASE-08 WSL full repair (Agent-D)

## 为什么
PHASE-08 完整修复 3 类真实跨平台缺陷，使 WSL 端 4 个 gen2 case 全部 PASS，validator ok:true。

## 改了什么
1. `scripts/task-lens/cli.ts` `isAbsolutePath`：接受 POSIX + Windows drive-letter + UNC（原来仅 `node:path.isAbsolute`，Linux 上 `C:/x` 判 false）。
2. `scripts/lib/workspace-paths.ts` `WorkspacePathsError`：message 统一加 `<CODE>: ` 前缀（`code` 属性保留），所有抛出点经构造器自动生效。
3. `scripts/validate-outcome-governance.ts` `sha()`：计算前将 `\r\n` 规范化为 `\n`（行尾无关哈希），所有读文件路径共用同一 sha()。
4. 级联重冻结 `plans/task-lens-outcome-v1/`：19 个 bundle v2 source 哈希、configuration_sha256、contract/spec/approval/amendment/event-003/004/run-result/13 个 gen2 receipt 全部引用哈希按新算法重算；amendment frozen_diff 按 expectedFrozenDiff 重新生成（新增 10 条 source change + changed_fields 7 项）。
5. 重跑 4 个 WSL case 并覆盖 out/err 捕获；gen2-tl-i-501-wsl receipt FAIL→PASS；run-result verdict FAIL→PASS；event-004 run_ref 同步。

## 决策
- amendment frozen_diff 增加条目属于哈希值重算的机械结果（from/to_sha256 为哈希字段），id/引用/execution_id/candidate_tree 全部未动。
- v1 链文件（contract v1/bundle v1/receipt case-001..004 等）未触碰；`runs/err/gen2-tl-x-001.txt` 为空属预期（validator 只写 stdout）。
- TL-I-501 成功路径另以 WORK_ONE_ROOT 验证通过（work-one 空 diff commit 得允许的 exit 13），无需测试健壮性修改。

## 验证
- `bun test scripts/task-lens` → 156/156（原 153/3）
- validator：`{"ok":true,"lifecycle":"ACTIVE","errors":[]}` RC=0；validator 测试 15/15；typecheck RC=0
- 4 个 WSL case：TL-C-401 35/0、TL-C-402 18/0、TL-I-501 22/0、TL-M-601 11/0 + typecheck RC=0

## 更新文档
- `plans/task-lens-outcome-v1/`：outcome-test-bundle-v2 / outcome-contract-v2 / acceptance-spec-v2 / outcome-amendment-v2 / outcome-approval-v2 / ledger/event-003+004 / runs/outcome-run-result-v2 / 13 个 runs/receipt/gen2-*.json / 4 个 WSL out+err 捕获
- 源码：`scripts/task-lens/cli.ts`、`scripts/lib/workspace-paths.ts`、`scripts/validate-outcome-governance.ts`
