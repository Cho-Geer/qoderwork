# Canonical Prompt Reference — DISPATCH_TOKEN Handoff Fix

**为什么**: dispatch_subagent 输出的完整 prompt 通过 LLM 传递给 Task() 时，LLM 会引入微小的格式/空白差异，导致 marker-consume.ts 的严格 SHA-256 hash 校验失败。这不是"弱模型行为问题"，而是 dispatch prompt handoff 契约过脆——依赖模型手工转交长 prompt 并要求字节级一致性。

**改了什么**:
- `.opencode/scripts/command-tools/dispatch-subagent.ts` — 入队后输出 `QUEUE_ID:<id>` 到 stdout 第二行
- `.opencode/service/dispatch/router.ts` — 解析两行 stdout，在返回的 prompt 末尾追加 `//QUEUE_ID:<id>` 标记
- `.opencode/plugin-handlers/before/task.ts` — 从 prompt 中提取 QUEUE_ID 传给 consumeDispatchMarker
- `.opencode/service/dispatch/marker-consume.ts` — 新增 QUEUE_ID canonical 路径（优先于 inline DISPATCH_TOKEN）：通过 queue_id JOIN dispatch_prompt_refs 读取磁盘上原始 prompt 文件做 hash 验证，完全绕过 LLM 复制的 prompt
- `.opencode/plugins/session.ts` — chat.message hook 中增加 grant binding fallback 逻辑，child session 首次消息时绑定 pending grant（session.created 代码仍保留，但 E2E 中发现该 plugin hook 不触发）

**决策**:
- QUEUE_ID 放在 prompt 尾部作为短标识（`//QUEUE_ID:36`），LLM 不太可能修改这种结构化标记
- Canonical 路径优先于 inline token 路径：如果 QUEUE_ID 可用且文件存在，直接从磁盘读取验证；否则 fallback 到 inline token
- Grant binding 增加 chat.message fallback，session.created 代码仍保留（E2E 验证发现 session.created plugin hook 不触发，但 SSE session.created 事件正常）
- 不降低 DISPATCH_TOKEN 校验为 warn-only，保留完整性保护

**E2E 验证结果（v4 live LLM test）**:
- QUEUE_ID canonical path: `Canonical prompt loaded from disk (2898 chars), LLM prompt was 2912 chars` — JS 字符串长度差 14 字符，差异主要来自 router.ts 追加的 `//QUEUE_ID:36` 标记（12 字符 + 换行），不能直接归因为 LLM drift
- DISPATCH_TOKEN verified against canonical prompt file — hash 校验通过
- Grant lifecycle 完整: `pending` → `bound`（child session via chat.message fallback）→ `consumed`（safe_framework_edit 成功后）
- Probe file `.opencode/_test_framework/probe-v4.txt` 写入 `canonical-e2e-ok` — 成功
- **已知缺陷**: dispatch_queue lease 不精确 — canonical path 中 `dbDequeueWithLease(agentType, sessionID)` 按 agentType lease 最早 pending 队列，不是按 queueId 精确 lease。v4 的 queueId=36 仍为 pending，运行时错误 lease 了旧 pending 队列。需修复为 `dbDequeueByQueueId(queueId, sessionID)` 或 `dbDequeueWithExactKey(dispatch_key, sessionID)`

**总体评估**: 主权限写入链路通过（canonical prompt 校验 + grant binding + safe_framework_edit + probe 写入），但 dispatch_queue lease 精确性仍有缺口，不能称为完整闭环。
