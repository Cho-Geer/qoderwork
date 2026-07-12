# Skill-summary L1-001 偏差修复

**为什么**: L1-001 live E2E 显示 keyword boost 仅 10/24 命中，主因是 `chat.message` 在 `agent=""` 时跳过 bridge 捕获，且 DB fallback 用 `part.data.role='user'` 查询死路。

**改了什么**:
- `work-one/.opencode/plugins/session.ts` — 将 skill-summary 用户文本 bridge 捕获提前到 `!sid || !agent` early return 之前，其余 session/grant/compliance 逻辑仍保留原 guard。
- `work-one/.opencode/plugin-handlers/system/skill-summary.ts` — fallback 改为 `part JOIN message` 并按 `message.data.role='user'` 取最新用户 text part；注入日志新增 `messageSource` 与 `recentTextLength`。
- `e2e-evidence/L1-001-skill-summary/FIX-SMOKE-2026-07-11.md` — 记录 typecheck、fallback SQL、live canary smoke 证据。

**决策**: 不移除 `chatMessageHook` 的 agent guard，避免扩大到 session_map/compliance/grant 逻辑；只提前无副作用的文本捕获。暂不把 L1-001 改判 PASS，需后续完整 24-session 回归后再更新矩阵。
