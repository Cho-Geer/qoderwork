# tree-watcher.ts Phase 1 MVP

**为什么**: blueprint `blueprint-todowrite-driven-weak-agent-supervision.md` Phase 1 要求 QoderWork 侧自动观察器，能读取 session tree + SSE + quality.jsonl 并输出 evidence capsule 和干预建议，形成弱模型自治 + 强模型关键监督的闭环。

**改了什么**:
- `qoderwork/scripts/tree-watcher.ts` — 新建 ~310 行，复用 monitor-tree.ts 的树构建/状态分类逻辑，新增 SSE JSONL tail、quality JSONL tail、evidence capsule builder、L0-L4 intervention policy、suggest-guide 输出

**核心能力**:
- `--capsule` 模式输出标准 evidence capsule JSON（tree/todoSignals/sseEvents/pendingQuestions/toolFailures/changedFiles/intervention）
- `--suggest-guide` 模式在 L2+ 干预时输出可复制的 `intervene.ts` 命令
- 默认模式输出状态行（同 monitor-tree 格式）+ 干预标签
- 启动时跳过已有 SSE/quality 事件（只观察新增事件）
- 退出码：0=all-idle, 2=error, 3=timeout

**决策**: 
1. 自包含单文件，不 import monitor-tree.ts（它们是独立 bun run 脚本），通过内联复用关键函数
2. 不实现 `--auto-guide`（第一阶段只建议不自动发送，避免误干预）
3. 不修改 work-one 框架代码（Phase 3 的 quality-contract.ts 增强留作后续）
