# Question 混合 Enforcement 实施与验证

**为什么**: Blueprint v2.0 要求将 Guidance Gate 的汇报通道从 acp_notify（MCP 工具，低遵从性）切换为 question（OpenCode 内置工具，高遵从性），同时修复 checkThreshold() 死代码问题。

**改了什么**:
- `.opencode/plugin-handlers/system/anti-bypass.ts` — 新增 `checkThreshold()` 调用 + Phase 1 指令 acp_notify→question
- `.opencode/plugin-handlers/before/anti-bypass.ts` — 新增 `isQuestionTool()` + guidance gate 白名单
- `.opencode/plugin-handlers/after/anti-bypass.ts` — 新增 question 检测（rewardReport→clearGuidance）+ import getFailureSummary
- `.opencode/service/enforcement/tool-tracker.ts` — checkThreshold() directive acp_notify→question
- `qoderwork/scripts/deliver-guidance.sh` — 新建 QoderWork 直写 DB 脚本
- `qoderwork/scripts/test-hybrid-enforcement.ts` — 单元测试（35 assertions）
- `qoderwork/scripts/test-integration.ts` — 集成测试（31 assertions）

**决策**: 
- 使用 `clearGuidance()` 而非 `clearAwaitingGuidance()`（不要求 guidance_requested_at>0，更简单）
- after-hook 用 `getFailureSummary().consecutiveFailures > 0` 替代 `getGuidanceStatus().lastFailureTool` 检测累积失败（修复了 getGuidanceStatus 在 awaiting_guidance=0 时返回空值的 bug）
- acp_notify 路径保留向后兼容
