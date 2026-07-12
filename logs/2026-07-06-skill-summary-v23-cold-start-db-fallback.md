# skill-summary v2.3 冷启动 DB fallback 补丁

**为什么**: 运行验证发现 v2.2 桥接在 Orchestrator 首轮 LLM 请求时存在冷启动盲区 — `session.ts` 的 `chatMessageHook` 在 `!sid || !agent` 时 early return，而 SDK 对 Orchestrator 首次调用尚未完成身份解析（input.agent=""），导致桥接 Map 在首轮 system.transform 时为空，关键词匹配失败。Build sub-agent 不受影响（身份已解析）。

**改了什么**:
- `work-one/.opencode/plugin-handlers/system/skill-summary.ts` v2.3 — 新增 `coldStartDbFallback(sessionID)` 函数：从 SDK 的 `opencode.db` 的 `part` 表读取当前 session 最新 `type='text'` 的 data.text，4KB 上限，结果缓存 60s 避免热路径重复 SQLite 查询。`extractRecentMessage()` 改为：桥接优先 → 桥接空时调 fallback。

**决策**:
- 否决方案 A：修改 `chatMessageHook` 的 early return 条件（去掉 `!agent` 检查）— 会影响其他依赖 agent 字段的逻辑（如 session_map 注册、compliance audit），副作用面过大
- 否决方案 B：在 system.transform 中同步等待 chat.message 完成 — 引入跨 hook 同步原语，破坏 OpenCode hook 调度的 fire-and-forget 契约
- 采用方案：DB fallback + 60s per-session cache。优点：零侵入 session.ts、只在冷启动命中一次 DB、缓存 TTL 与 system.prompt 刷新频率匹配

**风险与缓解**:
- Fallback 读到的可能是上一轮 assistant text 而非当前 user text — 但关键词匹配对任何 session 内文本都优于 base-only 推荐
- SQLite 热路径开销 — 单次读查询 < 1ms，每 session 60s 内最多 1 次
- DB 不可用（SDK DB 锁冲突、路径异常）— try/catch 隔离，回退到空字符串

**验证下一步**: 重启 serve daemon，发 architecture 类 prompt，确认 Orchestrator 首轮日志 `keywordGroups` 非空。
