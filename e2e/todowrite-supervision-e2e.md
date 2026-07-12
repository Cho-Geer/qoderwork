# tree-watcher E2E 验证报告

**日期**: 2026-07-06
**Serve 端口**: 4096
**Session**: ses_0c809ce81ffe7UnVC8TbF76ViN

## 场景验证

| 场景 | 结果 | 证据 |
|------|:---:|------|
| D.1 正常任务观察 | PASS | 8 轮 capsule 输出，title 自动更新，L0 observe 全程 |
| D.2 TodoWrite 信号检测 | PASS | 信号正确记录，sessionID 有效，P1 由 QoderWork 实施 |
| D.3 Final Gate | PASS | 最终 capsule: all-idle, 无 toolFailures, 无 pendingQuestions |

## 观察详情

**Round 1-3**: Orchestrator working，读取 preflight-lite + codegraph-first SKILL.md
**Round 4**: session.idle SSE 事件捕获，title 更新为 "preflight-lite codegraph-first differenc"
**Round 7-8**: all-idle x2 → exit 0

## Capsule 字段验证

- [x] rootSessionId 正确
- [x] tree 数组包含节点状态
- [x] sseEvents 捕获 session.diff + session.idle
- [x] todoSignals 为空（trivial 任务无 TodoWrite）
- [x] pendingQuestions 为空
- [x] toolFailures 为空
- [x] intervention.level = "L0" + name = "observe"

## D.2 TodoWrite 信号检测（dispatch_privilege 实施任务）

**任务**: 指导 Orchestrator 按 blueprint-dispatch-scope-privilege.md 实施 P0+P1
**Session**: Orchestrator `ses_0c8019a26ffeBcCIJEmPggN8kE` → build `ses_0c7ff89fdffeFiCgFPy1XGq3T2`
**tree-watcher**: 启动正常，观察到两个 session 均创建了 TodoWrite

### quality.jsonl 信号记录

信号**有记录**，包括：
- `todo_write_observed | build` (多次)
- `todo_write_mismatch | build`
- `todo_failure_without_recovery | build`
- `todo_stale_after_tools | Orchestrator`
- `todo_missing_for_nontrivial | unknown` (3 次，"No TodoWrite observed before non-trivial tool task")

### sessionId 诊断修正

初始诊断报告"sessionId 为空"是**误报**。实际原因是解析脚本使用了 camelCase `sessionId`，但 quality.jsonl 中的字段名是 `sessionID`（大写 D）。quality-contract.ts 和 jsonl-writer.ts 正确写入了 sessionID 值（如 `ses_0c7ff89fdffeFiCgFPy1XGq3T2`）。**quality-contract.ts 无 bug，不需要修复。**

### 实施结果（QoderWork 直接实施）

| P1 交付物 | 状态 | 说明 |
|-----------|:---:|------|
| `dispatch_privilege_grants` 表 | PASS | db-manager.ts 16 列表 + 2 索引 |
| `privilege.ts` | PASS | 208 行，createGrant/bindGrant/hasGrant/consumeGrant/revokeGrant |
| router.ts privilege 校验 | PASS | Orchestrator-only 验证 |
| dispatch_subagent.ts 新参数 | PASS | DISPATCH_PRIVILEGE/ALLOWED_PATHS/REASON 环境变量 |
| P0-B ALTER TABLE 迁移 | PASS | dispatch_key/parent_session_id/call_id 幂等迁移 |

提交: `0963a0cc`，bun build 编译通过。

### D.2 结论

- quality-contract.ts **信号产生正常**，sessionID 字段正确
- tree-watcher.ts 使用正确的 `sessionID` 字段名进行过滤
- P1 dispatch_privilege 系统已由 QoderWork 直接实施（build agent 方案失败后切换）
