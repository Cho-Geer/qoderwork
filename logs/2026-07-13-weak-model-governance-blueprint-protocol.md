# 弱模型实施协议写入治理 blueprint

**为什么**: 用户希望弱模型负责实施，强审查模型负责最终审查和验证；原 blueprint 仍偏路线图，弱模型容易误把 core PASS 或组件测试通过当成整体完成。

**改了什么**:
- `blueprints/blueprint-tool-governance-mvc-refactor.md` — 升级到 v2.9.0，新增弱模型安全实施协议、角色分工、全局硬约束、完成判定门
- `blueprints/blueprint-tool-governance-mvc-refactor.md` — 新增 WG-01~WG-06 弱模型任务卡，覆盖文件跟踪、remote_write 变体、allow-path live E2E、资源类 E2E、grant lifecycle、日志字段审计
- `blueprints/blueprint-tool-governance-mvc-refactor.md` — 新增弱模型交付审查门、弱模型相关风险与成功标准

**决策**: 弱模型只负责窄任务实施和证据收集，不允许修改 blueprint 状态/checkbox；最终 PASS/完成判定必须由强审查模型或人工 reviewer 重跑验证后写入。
