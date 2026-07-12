# Session Persist Fail A+C 修复

**执行需求唯一ID**: `plan-20260708-01`
**日期**: `2026-07-08`

## 为什么

解决两个串联问题：
1. **A线**: `compliance_gate_check` 创建 gate session 后持久化失败却仍返回成功
2. **C线**: Orchestrator/anti-bypass 在连续失败或持久化异常时未强制上报，继续消耗 token 自救

## 改了什么

### A线 (Gate Session 持久化 Fail-Fast)
- `.opencode/service/gate/store-crud.ts`:
  - 新增 `GateStoreSaveResult` 结构化接口
  - `saveGateStore()` 现在返回完整错误信息，而非仅仅 boolean
- `.opencode/service/gate/mcp-check.ts`:
  - 检查 `saveGateStore()` 结果
  - 持久化失败时立即返回 `passed: false` 和空 `session_id`
  - 新增 `gate_store_persist_failed` 失败项
- `.opencode/service/gate/mcp-confirm.ts`:
  - Session not found 时增加诊断日志
  - 记录可用 session 数量，帮助调试

### C线 (Anti-Bypass Fail-Closed)
- `.opencode/service/enforcement/tool-tracker.ts`:
  - `ThresholdCheck` 接口新增 `tracker_error` 和 `tracker_error_message`
  - `checkThreshold()` 异常时返回错误状态
- `.opencode/plugin-handlers/system/anti-bypass.ts`:
  - 新增 `buildPersistenceFailureDirective()` 函数
  - 检测到 tracker 错误时注入 fallback directive
  - `getGuidanceStatus()` 异常时也注入 fallback
  - 全局 catch 异常时注入 fallback，确保 fail-closed
- `.opencode/agents/Orchestrator.md`:
  - 新增 "Non-Recoverable Errors" 章节
  - 明确 persistence/EROFS/session not found 等错误必须立即上报，禁止自救

## 决策

采用方案 B (Fail-Fast + Fail-Closed)：
- 最小化改动，快速建立保障
- 同时修复 A 和 C 两条线
- 避免全量重构的风险
