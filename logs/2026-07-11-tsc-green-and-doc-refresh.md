# TSC green and doc refresh

**为什么**: 在完成工具层 `any` 和 handler 空 `catch` 收敛后，还需要继续消化真实 `tsc` 红项，把文档从“类型检查仍红”刷新到当前事实。

**改了什么**:
- `work-one/.opencode/{service,plugin-handlers,scripts}/*.ts` — 修复 tool-governance 导入与日志级别类型、gate store 日志包装、repo audit 事件类型、pre-execution-gate 导出/模式记录、UC7KS 写入检查的旧签名兼容。
- `team-elevation/{04,05,README}.md` — 更新为当前状态：`bun run lint` / `tsc --noEmit` 已恢复绿色；F3 剩余风险主要是 `strict: false`，不再是现有红编译错误。

**决策**: 本轮没有扩展到 service/script 层的 109 个空 `catch` 清扫；验证上以 `tsc` 绿灯为主，Jest 目标用例受 Bun/Jest 环境初始化异常阻塞，单独记录为环境问题而不是代码回归。
