# dispatch_privilege P0+P1 实施失败 + D.2 E2E 发现

**为什么**: 验证 tree-watcher 的 TodoWrite 信号检测能力（D.2 场景），同时推进 dispatch_privilege_grants 蓝图实施。

**改了什么**:
- `e2e/todowrite-supervision-e2e.md` — D.2 从 SKIP 更新为 FAIL，记录 sessionId 缺失缺陷
- work-one 仓库无 P1 相关变更（build agent 做了 235 文件无关重构）

**发现**:
1. quality-contract.ts 写入 quality.jsonl 时 sessionId 为空，tree-watcher 无法归属信号到 session tree
2. build agent 完全偏离 P1 任务，执行了大规模代码清理（删除 .bak 文件、agent .md 文件等）
3. 5 个 P1 交付物全部缺失：dispatch_privilege_grants 表、privilege.ts、router.ts 校验、session.ts 绑定、dispatch_subagent.ts 参数
4. 信号产生正常（todo_write_observed/mismatch/stale/failure/missing 均有），但无法 session-scoped 过滤

**决策**: 
- 判定 Rework，P1 需重新实施
- 优先修复 quality-contract.ts sessionId 问题（监督闭环的前提）
- build agent 的无关重构需要 git revert
