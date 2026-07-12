# DB Fallback 故障注入 + ACP/SSE Watcher 验证报告

**日期**: 2026-07-06
**Serve 端口**: 4096
**SSE 事件总量**: 20,093

---

## Part 1: DB Fallback 故障注入验证

### 1.1 session-tree.ts

| 测试 | 预期 | 实际 | 结果 |
|------|------|------|------|
| dbFallbackChildren(已知 parent, 2 children) | 2 children | 2 children | PASS |
| dbFallbackChildren(Orchestrator root, 12 children) | >5 children | 12 children | PASS |
| dbFallbackChildren(不存在的 SID) | 0 children | 0 children | PASS |
| dbFallbackChildren(空字符串) | 0 children | 0 children | PASS |
| 返回格式 {id: string, agent: string} | 符合 | 符合 | PASS |
| --port 9 (serve 不可达) | exit=2 | exit=2 | PASS |
| 正常 serve | exit=0 + 正确树 | exit=0 + 3 节点 | PASS |

**结论**: session-tree.ts DB fallback 函数 7/7 PASS

### 1.2 monitor-tree.ts

| 测试 | 预期 | 实际 | 结果 |
|------|------|------|------|
| --port 9 (serve 不可达) | exit=2 + error 输出 | exit=2 + "[error] at least one node returned HTTP error" | PASS |
| 正常 serve (全 idle) | exit=0 + "all idle x2" | exit=0 + "all idle x2 rounds" | PASS |

**结论**: monitor-tree.ts 故障处理 2/2 PASS

### 1.3 未覆盖的故障场景

以下场景当前未做故障注入测试（需要 mock server 或中间人代理）：

- `/children` 返回 200 但 body 为 HTML（非 JSON）→ 触发 non-array fallback
- `/children` 返回 500 → 触发 catch fallback
- DB 文件不存在 → dbFallbackChildren 应返回 []

**建议**: 下一步可用 bun 写一个 minimal HTTP proxy，对 `/children` 路径返回非数组响应，验证 fallback 路径。

---

## Part 2: ACP/SSE Watcher 自动监督验证

### 2.1 架构验证

通过真实 Orchestrator 任务验证了完整的监督链路：

```
QoderWork ──prompt_async──→ Orchestrator
                              │ dispatch 3x explore
                              ├─→ child-1 (§1.1 double CLI)
                              ├─→ child-2 (§2.2 shell bypass)
                              └─→ child-3 (§4.1 dispatch_key)
                              │
sse-daemon ──SSE──→ /tmp/sse-events.jsonl (20,093 events)
                              │
monitor-tree ──poll──→ working→idle 转变检测 → exit=0
                              │
session-tree ──query──→ 1 root + 3 children 树结构
                              │
intervene.ts ──status──→ 实时状态检查
```

### 2.2 Orchestrator 真实任务执行

**任务**: 分析 `orchestrator-dispatch-empty-result-enforcement-plan-20260627.md` 三项核心结论在框架重构后是否仍属实

**执行过程**:
1. Orchestrator 读取 631 行文档
2. 识别 3 个验证点，派遣 3 个 explore 子 agent 并行调查
3. monitor-tree 跟踪: 3 child working → 逐个 idle → 全树 idle (exit=0)
4. 追加 prompt 要求综合结论
5. Orchestrator 输出结构化判定表

**Orchestrator 最终结论**:

| 章节 | 主张 | 判定 |
|------|------|------|
| §1.1 | 两次 CLI 调用 → 重复 DB 行 | **ALREADY FIXED** ✅ |
| §2.2 | scope-before.ts 允许 /tmp heredoc 暂存 | **PARTIALLY FIXED** ⚠️ |
| §4.1 | dispatch_queue 缺 dispatch_key 精确租赁 | **STILL VALID** ❌ |

**关键发现**:
- `dispatch_subagent.ts` 从 869 行重构到 49 行，双重 CLI 调用已消除
- `scope-before.ts` 已不存在，重构为模块化架构，`>` 重定向被结构性阻断，但 payload 内容扫描仍缺位
- `dispatch_key` 在代码中零出现，`queue.ts:107` 仍按 `agent_type` 出队，`rule-disposition.ts:71` 设为 `audit_only`

### 2.3 SSE 事件统计

| 事件类型 | Orchestrator session tree 数量 |
|---------|------|
| message.part.delta | 4,907 |
| message.part.updated | 72 |
| session.updated | 58 |
| message.updated | 39 |
| session.status | 20 |
| session.diff | 10 |
| session.created | 4 |
| session.idle | 1 |

### 2.4 /preflight-lite 技能使用

任务 prompt 包含 "请使用 /preflight-lite 技能" 指令。Orchestrator 在思考过程中展示了任务分类和分析规划，符合 preflight-lite v3.0.0 的 §1 任务分类要求。

---

## Part 3: Session IDs

| 角色 | SID | 用途 |
|------|-----|------|
| Orchestrator root | `ses_0c860604bffeaemrawLhjtpVro` | dispatch-plan-review |
| child-1 | `ses_0c85fcaceffeI7Ccu1tTswXjb9` | Check §1.1 double CLI dispatch |
| child-2 | `ses_0c85fb8aaffeunxR19Zu2KXeAN` | Check §2.2 shell write bypass |
| child-3 | `ses_0c85fa4c1ffeSDMcGZEZDEfn1j` | Check §4.1 dispatch_key column |

---

## Part 4: tree-watcher.ts 设计方案

### 与现有工具的关系

| 工具 | 功能 | 局限 |
|------|------|------|
| sse-daemon.ts | SSE 事件采集 → JSONL | 被动记录，无主动干预 |
| monitor-tree.ts | 轮询树状态 → idle 检测退出 | 单次运行，无自动干预 |
| intervene.ts | 手动 guide/reply-qid/abort | 需要外部调用 |
| **tree-watcher.ts (设计)** | **持续守护 + 自动干预** | 待实现 |

### tree-watcher.ts 核心逻辑

```typescript
// 1. 尾随 SSE JSONL (实时事件)
// 2. 每 N 秒 poll session tree (状态快照)
// 3. 规则引擎:
//    - working > 120s → auto-guide("你在做什么?")
//    - question unanswered > 60s → 通知 QoderWork
//    - error cascade → auto-abort
//    - all-idle → 输出 timeline 报告
// 4. 输出 supervision-timeline.jsonl
```

### 验证结论

通过真实 Orchestrator 任务验证了 ACP/SSE watcher 的**手动监督链路**（SSE daemon + monitor-tree + intervene.ts）完全可用。自动化层（tree-watcher.ts）的设计已明确，但实现和验证留作后续任务。

---

## 总体评估

| 验证项 | 结果 |
|--------|------|
| DB fallback 函数正确性 | **PASS** (7/7) |
| DB fallback 脚本级故障处理 | **PASS** (2/2) |
| SSE daemon 持续采集 | **PASS** (20,093 events) |
| monitor-tree 全树状态跟踪 | **PASS** (working→idle 转变) |
| Orchestrator 真实任务执行 | **PASS** (3 子 agent + 综合结论) |
| /preflight-lite 技能指令传递 | **PASS** (Orchestrator 展示任务分类) |
| tree-watcher.ts 自动化 | **DESIGNED** (待实现) |
