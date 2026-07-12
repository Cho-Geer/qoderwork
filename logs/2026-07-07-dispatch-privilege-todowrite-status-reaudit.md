# Dispatch privilege 与 TodoWrite 监督状态复核

**为什么**: work-one 框架已有新实现，需要把两个 blueprint 的实施状态从计划态同步到当前代码事实，避免把组件级 PASS 误读为 live E2E 通过。

**改了什么**:
- `blueprints/blueprint-dispatch-scope-privilege.md` — 标记 P0/P1/P2/P4 为部分完成，列出 exact key、router env、CodeGraph bypass、权限暴露等阻断点
- `blueprints/blueprint-todowrite-driven-weak-agent-supervision.md` — 标记 tree-watcher MVP、skill 文档和 D.1-D.3 E2E 基本完成，保留 Phase 3 payload 增强和高风险 E2E 遗留项

**决策**: 不把 `todowrite-supervision-e2e.md` 的 dispatch privilege D.2 结论视为 live E2E 通过；它只证明表、grant service 和入口等组件级实现存在。
