# skill-summary v2.2 跨 hook 会话桥接修复

**为什么**: E2E 测试 S1-001/S1-002 实测 FAIL，根因是 `skill-summary.ts` v2.1 的 `extractRecentMessage()` 读取了 `input.lastUserMessage` / `input.message` / `input.parts` / `input.conversation.messages` 四个字段，但 OpenCode 官方 SDK 类型（`@opencode-ai/plugin/dist/index.d.ts:265-270`）严格限定 `experimental.chat.system.transform` 的 input 为 `{ sessionID?: string; model: Model }`，不含任何用户消息内容。v2.1 方案在 SDK 类型契约下**结构上不可能工作**，所有历史日志中 `keywordGroups: "none"` 与该根因一致。该 bug 同时导致 freshness/todo/scout 软治理决策永远落在默认值。

**改了什么**:
- `work-one/.opencode/plugin-handlers/system/skill-summary.ts` v2.2 — 引入模块级 `recentMessageBridge: Map<sessionID, {text, capturedAt}>`，256 条 LRU 上限 + 30 分钟 TTL，导出 `captureUserMessage()` / `consumeUserMessage()`。`extractRecentMessage()` 改为单行 `consumeUserMessage(input.sessionID)`，删除所有字段猜测分支。
- `work-one/.opencode/plugins/session.ts` — `chatMessageHook` 从 `output.parts[]` 提取 text 类型片段（4KB 上限），通过 `captureUserMessage(sid, text)` 写入桥接 Map。best-effort try/catch 隔离，不阻断主 chat.message 流程。

**决策**: 选用 `chat.message` → `system.transform` 跨 hook 桥接，而不是其他候选方案：
- 否决方案 A：直接读 `experimental.chat.messages.transform` 的 output.messages — 虽然 input/output 携带完整 messages，但触发时机晚于 system.transform（system prompt 已构造），无法用于当前轮注入。
- 否决方案 B：每次 system.transform 里查 SDK 的 opencode.db 取历史消息 — 热路径加 DB 查询与 Minimal State 原则冲突。
- 否决方案 C：在 skill-summary 里同时注册 chat.message hook — 会增加 plugins 注册复杂度且打破"session 插件统一管 chat.message"的现有内聚。
- 采用方案：Map-based 跨 hook 桥接，复用 session.ts 已有的 chatMessageHook 入口，O(1) 读写、零 DB 开销、按 sessionID 天然隔离父子 Agent。

**文档同步更新**:
- `qoderwork/e2e/opencode-framework-simplification-e2e-results.md` — 新增 Remediation Addendum 段，保留原 FAIL 历史状态同时记录修复路径
- `qoderwork/blueprints/blueprint-opencode-framework-simplification-roadmap.md` — §0.1 遗留 #1 打勾、§0.2 复核 #3 打勾、§0.1 已落地 #3 更新、新增末尾"蓝图修订日志"段
- `qoderwork/implementation-plans/phase3-implementation-plan.md` — §0.0 结论调整、§0.0a P0 缺陷打勾、新增 §0.0b 修复记录
- `qoderwork/plans/opencode-framework-simplification-roadmap/02-phase1-skill-first.md` — 状态头更新、未完成列表打勾、T1.1/T1.2 验证步骤打勾、验收标准打勾

**下一步**: 重启 serve daemon（`bun run scripts/start-serve.ts --stop && bun run scripts/start-serve.ts`），发送含 source-edit / architecture / 中文关键词的 prompt，在 `.task_temp/_logs/*/plugin-plugin-skill-summary-runtime.log` 中确认 `SKILL-SUMMARY-INJECTED` 的 `keywordGroups` 非空，然后更新 E2E 结果文件 Final Summary Table。
