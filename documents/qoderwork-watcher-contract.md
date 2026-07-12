# QoderWork Watcher — JSONL 事件契约与 R1–R7 规则

> 配套实现：`scripts/qoder-watcher.ts`
> 依据：`plans/02-phase1-skill-first.md` Step 7
> 状态：契约已落地；`quality/skill/guidance` 三类流的框架侧发射属于 Phase 4 JSONL audit 工作，当前 watcher 对缺失流优雅跳过。

## 1. 框架侧统一 JSONL 流

所有流位于 work-one 的 `.task_temp/_logs/`：

| 文件 | 事件 | 当前状态 |
|---|---|---|
| `audit.jsonl` | tool result、path、grant、backup、behavioral block/allow | ✅ 已发射（实测 109KB） |
| `quality.jsonl` | skipped skill、todo stale、verification missing | ⏳ Phase 4 落地 |
| `skill.jsonl` | loaded skill、attestation | ⏳ Phase 4 落地 |
| `guidance.jsonl` | question、prompt_async guidance、abort、break_glass | ⏳ Phase 4 落地 |

### 事件字段约定（草案）

```jsonc
// audit.jsonl
{ "timestamp":"ISO", "channel":"audit", "sessionID":"ses_…",
  "tool":"safe_shell", "event":"behavioral_path_blocked",
  "command":"…", "reason":"…", "result":"blocked|allowed|error" }

// quality.jsonl
{ "timestamp":"ISO", "sessionID":"ses_…",
  "event":"skipped_skill|todo_stale|verification_missing", "detail":"…" }

// skill.jsonl
{ "timestamp":"ISO", "sessionID":"ses_…",
  "event":"skill_loaded|skill_attestation", "skill":"preflight-lite", "matchScore":0.9 }

// guidance.jsonl
{ "timestamp":"ISO", "sessionID":"ses_…",
  "event":"question|prompt_async|abort|break_glass", "qid":"…", "body":"…" }
```

## 2. R1–R7 规则

| 规则 | 触发条件 | 近似检测（当前可用信号） |
|---|---|---|
| R1 repeated_failure | 同 session 30 分钟内 3 次 tool error | `audit.jsonl` 中 `result:"error"` 或 `event` 匹配 `/error/i`，按 session 30min 窗口计数 ≥3 |
| R2 skipped_brainstorming | 含糊任务被直接写入 | session 有写事件但无 `brainstorming` skill 加载记录（proxy） |
| R3 skipped_skill | 写入前缺任务匹配 Skill | session 有写事件但 `skill.jsonl` 无该 session 任何 `skill_loaded`（proxy） |
| R4 todo_stall | 10 分钟无 todo 更新 | `quality.jsonl` 出现 `todo_stale`（完整检测需 todo 流，Phase 4） |
| R5 no_verification | 编辑后无验证事件 | 写事件后窗口内无 `verification` 事件（proxy：`quality.jsonl` `verification_missing`） |
| R6 break_glass_usage | 出现 break-glass 事件 | `break-glass.jsonl` 非空 或 `audit.jsonl`/`guidance.jsonl` 出现 `break_glass` |
| R7 quality_degradation | R1/R2/R3 任意两项同 session | 组合上述规则输出 |

## 3. 介入通道（固定）

- 普通指导：`POST /session/{SID}/prompt_async`，body 带当前 agent。
- question 回复：`POST /question/{QID}/reply`。
- 止损：`POST /session/{SID}/abort`。

## 4. 运行

```bash
bun scripts/qoder-watcher.ts [--logs /path/to/.task_temp/_logs] [--since ISO]
```

输出触发的规则列表 + 每条的推荐介入通道。
