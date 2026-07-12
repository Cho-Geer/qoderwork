# F3/F4 tool-context and catch cleanup

**为什么**: team-elevation 最新文档把剩余工程风险收敛到 F3（工具层 `any`）和 F4（tools/handlers 空 `catch`），这轮需要把其中可低风险落地的部分真正修到代码里。

**改了什么**:
- `work-one/.opencode/tools/*.ts` — 引入共享 `tool-context.ts`，把工具执行上下文改成强类型，清掉工具层 15 个 `: any` / `as any` 命中；`dispatch_subagent.ts` 补了 `_frameworkMaintenance` 兼容字段声明。
- `work-one/.opencode/plugin-handlers/{before,after}/*.ts` — 清理 tools/plugin-handlers 中 6 个空 `catch`，改为显式 fallback 或 `writeLog()` 审计日志。
- `team-elevation/{01,04,05,README}.md` — 将文档状态更新为当前事实：工具层 `any` 为 0、tools/plugin-handlers 空 `catch` 为 0、runtime-like 剩余空 `catch` 为 109。

**决策**: 本轮优先做“边界层收敛”而不扩散到 service/script 全仓清扫；`bun run lint` 仍失败，但剩余错误来自既有仓内问题，不是这次改动引入。
