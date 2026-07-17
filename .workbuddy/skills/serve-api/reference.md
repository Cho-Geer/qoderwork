# Serve API Reference - Detailed Test Steps

## Section A: Session 能力端到端验证详细步骤

### A.1 环境准备

#### 确认基础设施

```bash
wsl -d Ubuntu-24.04 bash -c "
  test -x /home/zhaoge/.opencode/bin/opencode && echo 'opencode OK' || exit 1
  ! ss -tlnp 2>/dev/null | grep -q ':4096' && echo 'port 4096 OK' || { echo 'port 4096 in use'; exit 1; }
  which sqlite3 >/dev/null 2>&1 && echo 'sqlite3 OK' || { echo 'sqlite3 missing'; exit 1; }
"
```

#### 清理旧进程和临时文件

```bash
wsl -d Ubuntu-24.04 bash -c "
  pkill -f 'opencode serve' 2>/dev/null; sleep 1
  rm -rf /tmp/serve-e2e-test && mkdir -p /tmp/serve-e2e-test
  echo 'Environment ready'
"
```

#### 启动 opencode serve

```bash
wsl -d Ubuntu-24.04 bash -c "
  cd /home/zhaoge/workspace/opencode/work-one
  nohup /home/zhaoge/.opencode/bin/opencode serve --port 4096 > /tmp/serve-e2e-test/serve.log 2>&1 &
  echo \$! > /tmp/serve-e2e-test/serve.pid
  echo 'serve PID:' \$(cat /tmp/serve-e2e-test/serve.pid)
"
```

等待 serve 就绪：

```bash
wsl -d Ubuntu-24.04 bash -c "
  for i in \$(seq 1 15); do
    curl -s http://localhost:4096/api/health >/dev/null 2>&1 && { echo 'serve ready'; break; }
    [ \$i -eq 15 ] && { echo 'serve timeout'; exit 1; }
    sleep 1
  done
"
```

### A.2 验证 session 创建

使用 curl 直调创建 session：

```bash
curl -s -X POST http://localhost:4096/session \
  -H 'Content-Type: application/json' \
  -d '{"title":"e2e-verification","agent":"Orchestrator"}'
```

**预期结果**：返回 `{"id":"ses_xxx", ...}`，无超时错误。

**Pitfall — agent 字段必填**：不传 agent 则写入 "unknown"，导致 session_map 身份断链。

**Pitfall — 超时但 session 已创建**：如果 curl 超时，先用 `GET /session` 检查是否已创建，避免重复。

### A.3 手动 session_map 注册

#### 检查 session_map 是否已有记录

```bash
wsl -d Ubuntu-24.04 bash -c "
  DB='/home/zhaoge/workspace/opencode/work-one/.opencode/state/framework-state.db'
  SESSION_ID='<从 A.2 获取的 session_id>'
  echo '=== session_map 查询 ==='
  sqlite3 \"\$DB\" \"SELECT * FROM session_map WHERE session_id = '\$SESSION_ID';\"
  echo '=== session_registry 查询 ==='
  sqlite3 \"\$DB\" \"SELECT session_id, agent, parent_session_id, status FROM session_registry WHERE session_id = '\$SESSION_ID';\" 2>/dev/null || echo 'not in session_registry'
"
```

#### 手动 INSERT（如果无记录）

```bash
wsl -d Ubuntu-24.04 bash -c "
  DB='/home/zhaoge/workspace/opencode/work-one/.opencode/state/framework-state.db'
  SESSION_ID='<session_id>'
  sqlite3 \"\$DB\" \"INSERT OR IGNORE INTO session_map (session_id, agent, created_at, updated_at) VALUES ('\$SESSION_ID', 'Orchestrator', datetime('now'), datetime('now'));\"
  echo 'session_map inserted'
  sqlite3 \"\$DB\" \"SELECT * FROM session_map WHERE session_id = '\$SESSION_ID';\"
"
```

### A.4 验证消息发送 + agent 响应

发送一条**只读任务**（避免触发 enforcement 阻断）：

```bash
curl -s -X POST http://localhost:4096/session/{SID}/message \
  -H 'Content-Type: application/json' \
  -d '{"parts":[{"type":"text","text":"List the files in the current directory using the read tool. This is a read-only task."}]}'
```

**Pitfall — enforcement 阻断**：如果 agent 尝试使用非 passthrough 工具被阻断，记录为 PASS 但标注 "enforcement active"。

### A.5 验证 SSE 事件读取

```bash
# 读取 SSE JSONL 事件
tail -50 /tmp/sse-events.jsonl | grep "{SID}"

# 统计事件类型
tail -100 /tmp/sse-events.jsonl | python3 -c "
import sys,json,collections
c=collections.Counter(json.loads(l)['type'] for l in sys.stdin if l.strip())
[print(f'  {t}: {n}') for t,n in c.most_common()]"
```

**验证要点**：
- 事件数组非空
- 包含 `message.part.updated`、`session.status` 等事件类型

### A.6 验证双向事件（question / notify）

```bash
# 检查 question 事件
tail -200 /tmp/sse-events.jsonl | grep "question.asked"

# 检查 pending questions
curl -s http://localhost:4096/question
```

**与 SSE 事件的区别**：`GET /question` 返回当前所有 pending questions，SSE JSONL 包含历史事件流。

### A.7 验证 guidance 下发

#### 触发 agent 阻断

```bash
curl -s -X POST http://localhost:4096/session/{SID}/message \
  -H 'Content-Type: application/json' \
  -d '{"parts":[{"type":"text","text":"Create a new file called test-output.txt with the content hello world."}]}'
```

#### 投递 guidance

```bash
curl -s -X POST http://localhost:4096/session/{SID}/message \
  -H 'Content-Type: application/json' \
  -d '{"parts":[{"type":"text","text":"[Guidance]: You are blocked by enforcement. Please call config_read_attest() first, then retry."}]}'
```

#### 验证 guidance 效果

检查 agent 是否恢复执行：
```bash
curl -s "http://localhost:4096/session/{SID}/message?limit=1"
```

### A.8 验证 enforcement 重置

#### 查看当前 enforcement 状态

```bash
wsl -d Ubuntu-24.04 bash -c "
  DB='/home/zhaoge/workspace/opencode/work-one/.opencode/state/framework-state.db'
  SESSION_ID='<session_id>'
  echo '=== execution_checklist_runs ==='
  sqlite3 \"\$DB\" \"SELECT id, session_id, status FROM execution_checklist_runs WHERE session_id = '\$SESSION_ID';\" 2>/dev/null || echo 'no checklist runs'
  echo '=== tool_enforcement ==='
  sqlite3 \"\$DB\" \"SELECT * FROM tool_enforcement WHERE session_id = '\$SESSION_ID' LIMIT 5;\" 2>/dev/null || echo 'no enforcement records'
"
```

#### 重置 enforcement

```bash
wsl -d Ubuntu-24.04 bash -c "
  DB='/home/zhaoge/workspace/opencode/work-one/.opencode/state/framework-state.db'
  SESSION_ID='<session_id>'
  sqlite3 \"\$DB\" \"UPDATE execution_checklist_runs SET status = 'completed' WHERE session_id = '\$SESSION_ID';\"
  sqlite3 \"\$DB\" \"DELETE FROM tool_enforcement WHERE session_id = '\$SESSION_ID';\"
  echo 'Enforcement reset complete'
"
```

**注意**：这是测试绕过手段，生产环境不应使用。

### A.9 验证 write 操作

```bash
curl -s -X POST http://localhost:4096/session/{SID}/message \
  -H 'Content-Type: application/json' \
  -d '{"parts":[{"type":"text","text":"Create a file called e2e-test-write.txt with content serve API verification test."}]}'
```

验证文件存在：

```bash
ls -la /home/zhaoge/workspace/opencode/work-one/e2e-test-write.txt && echo 'Write PASS' || echo 'Write FAIL'
rm -f /home/zhaoge/workspace/opencode/work-one/e2e-test-write.txt
```

### A.10 验证 dispatch（sub-agent 调度）

```bash
curl -s -X POST http://localhost:4096/session/{SID}/message \
  -H 'Content-Type: application/json' \
  -d '{"parts":[{"type":"text","text":"Use the Task tool to dispatch a sub-agent that reads the README.md file and summarizes its first 3 lines."}]}'
```

检查子 session 创建：
```bash
curl -s "http://localhost:4096/session/{SID}/children"
```

### A.11 验证 question 回复

#### 触发 agent 提问

```bash
curl -s -X POST http://localhost:4096/session/{SID}/message \
  -H 'Content-Type: application/json' \
  -d '{"parts":[{"type":"text","text":"I need you to ask me a question. Use the question tool to ask: What is your favorite testing method?"}]}'
```

#### 检查 pending question

```bash
curl -s http://localhost:4096/question
```

#### 回复提问

```bash
# ⚠️ 格式：数组套数组 [["option-label"]]
curl -s -X POST http://localhost:4096/question/{QID}/reply \
  -H 'Content-Type: application/json' \
  -d '{"answers":[["serve API verification"]]}'
```

### A.12 验证 session 列表 + 终止

```bash
# 列出所有 sessions
curl -s http://localhost:4096/session
```

确认 session 在列表中。然后终止：

```bash
curl -s -X POST http://localhost:4096/session/{SID}/abort
```

再次 `GET /session` 确认 session 状态已变更。

### A.13 超时恢复验证

使用异步模式发送消息，然后轮询：

```bash
# 异步发送（不阻塞）
curl -s -X POST http://localhost:4096/session/{SID}/prompt_async \
  -H 'Content-Type: application/json' \
  -d '{"parts":[{"type":"text","text":"Perform a complex analysis of the entire codebase structure."}]}'

# 轮询 session 状态
curl -s http://localhost:4096/session/{SID}
```

验证 session 仍在处理中（agent 后台运行），然后 `POST /session/{SID}/abort` 清理。

### A.14 清理

```bash
wsl -d Ubuntu-24.04 bash -c "
  kill \$(cat /tmp/serve-e2e-test/serve.pid) 2>/dev/null
  sleep 2
  rm -rf /tmp/serve-e2e-test
  rm -f /home/zhaoge/workspace/opencode/work-one/e2e-test-write.txt
  echo 'Cleanup complete'
"
```

---

## Section B: 事件覆盖验证详细步骤

### B.1 环境准备

确认 opencode 二进制存在且端口未被占用：

```bash
wsl -d Ubuntu-24.04 bash -c "
  test -x /home/zhaoge/.opencode/bin/opencode && echo 'opencode OK' || exit 1
  ! ss -tlnp 2>/dev/null | grep -q ':${PORT}' && echo 'port ${PORT} OK' || { echo 'port ${PORT} in use'; exit 1; }
"
```

创建临时目录：

```bash
wsl -d Ubuntu-24.04 bash -c "rm -rf ${TEMP_DIR} && mkdir -p ${TEMP_DIR}"
```

### B.2 启动 serve + SSE 后台监听

#### 启动 opencode serve

```bash
wsl -d Ubuntu-24.04 bash -c "
  cd ${PROJECT_DIR}
  nohup /home/zhaoge/.opencode/bin/opencode serve --port ${PORT} > ${TEMP_DIR}/serve.log 2>&1 &
  echo \$! > ${TEMP_DIR}/serve.pid
  echo 'serve PID:' \$(cat ${TEMP_DIR}/serve.pid)
"
```

等待 serve 就绪：

```bash
wsl -d Ubuntu-24.04 bash -c "
  for i in \$(seq 1 10); do
    curl -s http://localhost:${PORT}/api/health >/dev/null 2>&1 && { echo 'serve ready'; break; }
    sleep 1
  done
"
```

#### 启动 SSE 后台监听

SSE 流必须在创建 session **之前**启动，确保捕获所有事件。

> **⚠️ 不能用 curl 连接 /event**（会无限挂起）。必须用 sse-daemon.ts（Bun fetch 实现）。

```bash
wsl -d Ubuntu-24.04 bash -c "
  export PATH=/home/zhaoge/.bun/bin:\$PATH
  setsid bun run /home/zhaoge/workspace/qoderwork/scripts/sse-daemon.ts > /tmp/sse-daemon.log 2>&1 < /dev/null &
  echo \$! > ${TEMP_DIR}/sse.pid
  echo 'SSE daemon PID:' \$(cat ${TEMP_DIR}/sse.pid)
"
```

验证 SSE 监听已启动：

```bash
wsl -d Ubuntu-24.04 bash -c "
  kill -0 \$(cat ${TEMP_DIR}/sse.pid) 2>/dev/null && echo 'SSE listener running' || echo 'SSE listener dead'
"
```

### B.3 创建 session

```bash
wsl -d Ubuntu-24.04 bash -c "
  RESPONSE=\$(curl -s -X POST http://localhost:${PORT}/session \
    -H 'Content-Type: application/json' \
    -d '{\"title\":\"event-verification-test\"}')
  echo \"\$RESPONSE\"
  SESSION_ID=\$(echo \"\$RESPONSE\" | jq -r '.id // .sessionId // empty')
  echo \"\$SESSION_ID\" > ${TEMP_DIR}/session-id
  echo 'Session ID:' \$SESSION_ID
"
```

如果响应结构不同，用 `jq '.'` 先查看完整响应，再调整字段提取路径。

### B.4 触发 acp_notify 事件

发送一条包含 acp_notify 指令的消息：

```bash
wsl -d Ubuntu-24.04 bash -c "
  SESSION_ID=\$(cat ${TEMP_DIR}/session-id)
  curl -s -X POST http://localhost:${PORT}/session/\${SESSION_ID}/message \
    -H 'Content-Type: application/json' \
    -d \"{\\\"parts\\\":[{\\\"type\\\":\\\"text\\\",\\\"text\\\":\\\"Please send an acp_notify event with the message: test-notification-from-serve\\\"}]}\"
"
```

等待 agent 处理完成：

```bash
wsl -d Ubuntu-24.04 bash -c "sleep 15 && wc -l ${SSE_FILE}"
```

### B.5 触发 question 事件

发送一条触发 `ask_user` 工具的消息：

```bash
wsl -d Ubuntu-24.04 bash -c "
  SESSION_ID=\$(cat ${TEMP_DIR}/session-id)
  curl -s -X POST http://localhost:${PORT}/session/\${SESSION_ID}/message \
    -H 'Content-Type: application/json' \
    -d \"{\\\"parts\\\":[{\\\"type\\\":\\\"text\\\",\\\"text\\\":\\\"I need to ask you a question. What is your favorite color? Please use the ask_user tool.\\\"}]}\"
"
```

等待 question 推送：

```bash
wsl -d Ubuntu-24.04 bash -c "sleep 15 && echo 'Wait complete'"
```

### B.6 分析验证

#### SSE 事件概览

```bash
wsl -d Ubuntu-24.04 bash -c "
  echo '=== Total SSE lines ==='
  wc -l ${SSE_FILE}
  echo ''
  echo '=== Event types ==='
  grep '^event:' ${SSE_FILE} | sort | uniq -c | sort -rn
  echo ''
  echo '=== First 50 lines ==='
  head -50 ${SSE_FILE}
"
```

#### 验证 message 事件

```bash
wsl -d Ubuntu-24.04 bash -c "grep -A2 '^event: message' ${SSE_FILE} | head -20"
```

#### 验证 acp_notify 事件

```bash
wsl -d Ubuntu-24.04 bash -c "grep -A5 '^event: acp_notify' ${SSE_FILE} | head -30"
```

#### 验证 question 事件

```bash
wsl -d Ubuntu-24.04 bash -c "grep -A5 '^event: question' ${SSE_FILE} | head -30"
```

#### 可选：DB 交叉验证

```bash
wsl -d Ubuntu-24.04 bash -c "
  DB_PATH='${PROJECT_DIR}/.opencode/state/framework-state.db'
  SESSION_ID=\$(cat ${TEMP_DIR}/session-id)
  sqlite3 \"\$DB_PATH\" \"SELECT id, title, created_at FROM session WHERE id = '\$SESSION_ID';\"
"
```

### B.7 清理

```bash
wsl -d Ubuntu-24.04 bash -c "
  kill \$(cat ${TEMP_DIR}/sse.pid) 2>/dev/null
  kill \$(cat ${TEMP_DIR}/serve.pid) 2>/dev/null
  sleep 2
  rm -rf ${TEMP_DIR}
  echo 'Cleanup complete'
"
```

---

## Section C: v1.3.0 Session 树监控与主动干预 E2E 验证

对应 SKILL.md §4 的 4 个新脚本（`session-tree.ts` / `monitor-tree.ts` / `guide.ts` / `intervene.ts`）与 Turn 模型。

### C.0 前置条件

- serve daemon 已启动（`bun run scripts/start-serve.ts`，参考 §A.1 环境准备）
- bun 1.3+、python3、curl 可用
- 脚本路径：`/home/zhaoge/workspace/qoderwork/scripts/`

```bash
# 健康检查
curl -s http://localhost:4096/session/status >/dev/null && echo "serve ready" || exit 1
ls /home/zhaoge/workspace/qoderwork/scripts/{session-tree,monitor-tree,guide,intervene}.ts
```

### C.1 场景 A：`session-tree.ts` 查询 2 层树

**目的**：验证主 agent 派遣 1 个 build 子 agent 后，`session-tree.ts` 正确返回 parent-child 关系。

```bash
# 1. 创建 Orchestrator 主 session
PARENT=$(curl -s -X POST http://localhost:4096/session \
  -H 'Content-Type: application/json' \
  -d '{"title":"tree-test-A","agent":"Orchestrator"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "PARENT=$PARENT"

# 2. 异步发送派遣 prompt
curl -s -X POST "http://localhost:4096/session/${PARENT}/prompt_async" \
  -H 'Content-Type: application/json' \
  -d "{\"parts\":[{\"type\":\"text\",\"text\":\"请用 native Task 派遣一个 build 子 Agent 读取 /home/zhaoge/workspace/opencode/work-one/AGENTS.md 前 10 行并返回摘要，不要自己做。\"}]}"

# 3. 等待子 session 创建
sleep 40

# 4. 查询 session 树
bun run /home/zhaoge/workspace/qoderwork/scripts/session-tree.ts $PARENT
```

**预期输出**：

```
ses_PARENT... | Orchestrator | root | tree-test-A
└─ ses_CHILD... | Orchestrator | child | Read AGENTS.md first 10 lines (@build subagent)
```

**JSON 输出**（加 `--json`）：

```bash
bun run /home/zhaoge/workspace/qoderwork/scripts/session-tree.ts $PARENT --json | python3 -c "
import sys, json
t = json.load(sys.stdin)
assert t['root'] == '$PARENT'
assert len(t['allIds']) == 2
assert len(t['leafIds']) == 1
print('PASS: root + 1 child + 1 leaf')
"
```

**PASS 条件**：
- [ ] 树输出含 1 个 root + 1 个 child
- [ ] JSON 输出 `allIds.length == 2`、`leafIds.length == 1`
- [ ] child 的 `parent` 字段 == PARENT SID

### C.2 场景 B：`monitor-tree.ts` 全树监控（root idle + child working → 全树 idle）

**目的**：验证 monitor-tree 同时监控主 agent 和子 agent，并在全树 idle 时正确退出。

```bash
# 1. 复用场景 A 的 PARENT（或新创建 + 派遣）
# 2. 启动 monitor-tree（interval=3s 加速，timeout=60s）
bun run /home/zhaoge/workspace/qoderwork/scripts/monitor-tree.ts $PARENT --interval=3 --timeout=60
echo "exit=$?"
```

**预期输出**：

```
[08:25:00] root=Orchestrator(idle)    | child=build(working) | pending=0
[08:25:03] root=Orchestrator(idle)    | child=build(working) | pending=0
...
[08:25:30] root=Orchestrator(idle)    | child=build(idle)    | pending=0
[08:25:33] root=Orchestrator(idle)    | child=build(idle)    | pending=0
[08:25:33] ✓ all idle x2 rounds, tree completed
exit=0
```

**PASS 条件**：
- [ ] 退出码 `0`
- [ ] 输出中同时出现过 `child=... (working)` 和 `child=... (idle)` 两种状态
- [ ] 最后一行 `✓ all idle x2 rounds` 出现
- [ ] 连续 2 轮 idle 后退出

### C.3 场景 C：`intervene.ts --mode=guide` 直发子 session（身份保留）

**目的**：验证通过 intervene.ts 给子 session 发 guidance，子 session 的 agent 字段保持不变。

```bash
# 1. 用 session-tree 拿到 child SID 和真实 agent
CHILD=$(bun run /home/zhaoge/workspace/qoderwork/scripts/session-tree.ts $PARENT --json \
  | python3 -c "import sys,json; t=json.load(sys.stdin); print(t['leafIds'][0])")
echo "CHILD=$CHILD"

AGENT_BEFORE=$(curl -s "http://localhost:4096/session/${CHILD}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['agent'])")
echo "AGENT_BEFORE=$AGENT_BEFORE"

# 2. 用 intervene.ts 发 guidance
bun run /home/zhaoge/workspace/qoderwork/scripts/intervene.ts $CHILD \
  --mode=guide --text="[guide-test] please acknowledge receipt"

# 3. 等待处理
sleep 5

# 4. 验证身份保留
AGENT_AFTER=$(curl -s "http://localhost:4096/session/${CHILD}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['agent'])")
echo "AGENT_AFTER=$AGENT_AFTER"

# 5. 对比
[ "$AGENT_BEFORE" = "$AGENT_AFTER" ] && echo "PASS: identity preserved" || echo "FAIL: identity changed"
```

**PASS 条件**：
- [ ] `intervene.ts` 输出 `✓ guide sent` 且 `agent: <X> (preserved)`
- [ ] `AGENT_BEFORE == AGENT_AFTER`
- [ ] child session 不变成 `Orchestrator`（除非它本来就是）

### C.4 场景 D：父子同时发出 question，分别路由到正确目标

**目的**：验证 `GET /question` 返回多个 pending questions 时，能根据 `sessionID` 区分路由。

```bash
# 1. 创建 2 个独立 session（模拟父子），都诱导它们发出 question
for title in parent-q child-q; do
  SID=$(curl -s -X POST http://localhost:4096/session \
    -H 'Content-Type: application/json' \
    -d "{\"title\":\"${title}\",\"agent\":\"Orchestrator\"}" \
    | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
  curl -s -X POST "http://localhost:4096/session/${SID}/prompt_async" \
    -H 'Content-Type: application/json' \
    -d "{\"parts\":[{\"type\":\"text\",\"text\":\"如果不确定该做什么，请先向我提问澄清。\"}]}"
  echo "${title}=${SID}"
done

sleep 30

# 2. 列出所有 pending questions
curl -s http://localhost:4096/question | python3 -c "
import sys, json
qs = json.load(sys.stdin)
for q in qs:
    print(f'{q[\"id\"]} | {q[\"sessionID\"]} | {q[\"questions\"][0][\"question\"][:60]}')
"

# 3. 对每个 question 用 intervene.ts --mode=reply-qid 回复
# intervene.ts 内部会校验 QID 属于 SID
QID=$(curl -s http://localhost:4096/question | python3 -c "
import sys, json
qs = json.load(sys.stdin)
print(qs[0]['id'] if qs else '')")
TARGET_SID=$(curl -s http://localhost:4096/question | python3 -c "
import sys, json
qs = json.load(sys.stdin)
print(qs[0]['sessionID'] if qs else '')")

bun run /home/zhaoge/workspace/qoderwork/scripts/intervene.ts $TARGET_SID \
  --mode=reply-qid $QID --text="请继续执行主任务。"
```

**PASS 条件**：
- [ ] `GET /question` 返回的每条 question 都含 `sessionID`
- [ ] `intervene.ts --mode=reply-qid` 成功回复，不报 "QID does not belong to SID"
- [ ] 用错误的 SID 调用时 exit code = 3（路由校验触发）

**负向测试**（路由校验）：

```bash
# 故意用错误的 SID
WRONG_SID="ses_0000000000000000000000fake"
bun run /home/zhaoge/workspace/qoderwork/scripts/intervene.ts $WRONG_SID \
  --mode=reply-qid $QID --text="x"
echo "exit=$?"   # 期望 exit=3
```

### C.5 场景 E：Mid-turn 注入延迟到下一 turn 才生效

**目的**：验证 `prompt_async` 在 agent 跑 tool 时无法立即注入，需等 turn 边界。

```bash
# 1. 创建 session 并让 agent 跑长任务（多个 tool calls）
SID=$(curl -s -X POST http://localhost:4096/session \
  -H 'Content-Type: application/json' \
  -d '{"title":"mid-turn-test","agent":"Orchestrator"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

curl -s -X POST "http://localhost:4096/session/${SID}/prompt_async" \
  -H 'Content-Type: application/json' \
  -d "{\"parts\":[{\"type\":\"text\",\"text\":\"请依次读取 /home/zhaoge/workspace/opencode/work-one/.opencode/skills 下前 5 个 SKILL.md 文件的行数，每次读取后 sleep 3 秒。\"}]}"

# 2. 在 agent 还在跑 tool 时（约 10s 后）尝试注入 guidance
sleep 10
bun run /home/zhaoge/workspace/qoderwork/scripts/intervene.ts $SID --mode=status
# 预期输出：working（说明 turn 未结束）

INJECT_TIME=$(date +%s)
bun run /home/zhaoge/workspace/qoderwork/scripts/intervene.ts $SID \
  --mode=guide --text="[mid-turn-injection] acknowledge when you see this"

# 3. 等待 turn 结束，记录 assistant 实际看到 guidance 的时间
sleep 60
FIRST_SEEN=$(curl -s "http://localhost:4096/session/${SID}/message?limit=20" \
  | python3 -c "
import sys, json
msgs = json.load(sys.stdin)
for m in msgs:
    for p in m.get('parts', []):
        if 'mid-turn-injection' in (p.get('text') or ''):
            print(m['info']['time']['created'])
            break
")
echo "INJECT_TIME=$INJECT_TIME FIRST_SEEN=$FIRST_SEEN"
echo "delay=$((FIRST_SEEN/1000 - INJECT_TIME))s"
```

**PASS 条件**：
- [ ] 注入瞬间 `intervene.ts --mode=status` 输出 `working`
- [ ] `FIRST_SEEN - INJECT_TIME >= 3s`（证明不是在 turn 中立即生效）
- [ ] guidance 最终在下一 turn 被 agent 看到并回复

### C.6 场景 F：子 agent 陷入循环，`intervene.ts --mode=abort` 止损

**目的**：验证 abort 能终止失控的子 session，并在 10s 内确认。

```bash
# 1. 创建可能陷入循环的子 session（例如让它反复尝试不可能完成的写入）
CHILD=$(curl -s -X POST http://localhost:4096/session \
  -H 'Content-Type: application/json' \
  -d '{"title":"abort-test","agent":"Orchestrator"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

# 2. 发一个会让 agent 反复尝试的任务
curl -s -X POST "http://localhost:4096/session/${CHILD}/prompt_async" \
  -H 'Content-Type: application/json' \
  -d "{\"parts\":[{\"type\":\"text\",\"text\":\"请一直尝试读取 /nonexistent/path 直到成功，不要停。\"}]}"

# 3. 等 15s 让它跑起来
sleep 15

# 4. 验证 status 是 working
bun run /home/zhaoge/workspace/qoderwork/scripts/intervene.ts $CHILD --mode=status

# 5. abort
bun run /home/zhaoge/workspace/qoderwork/scripts/intervene.ts $CHILD --mode=abort

# 6. 确认 status 不再是 working
sleep 5
bun run /home/zhaoge/workspace/qoderwork/scripts/intervene.ts $CHILD --mode=status
```

**预期输出**：

```
ses_CHILD... | working | agent=Orchestrator | title=abort-test
✓ abort sent
  sid:       ses_CHILD...
  confirmed: yes
ses_CHILD... | idle | agent=Orchestrator | title=abort-test
```

**PASS 条件**：
- [ ] abort 前 status = `working`
- [ ] `intervene.ts --mode=abort` 输出 `confirmed: yes`
- [ ] abort 后 status 变为 `idle`（或 error）
- [ ] 不再有新的 `message.updated` 事件

### C.7 结果汇总模板

```markdown
## Serve API v1.3.0 E2E 验证报告

**日期**: YYYY-MM-DD
**Serve 版本**: <opencode --version>
**Serve 端口**: 4096

### 脚本验证
- [ ] session-tree.ts: 场景 A PASS
- [ ] monitor-tree.ts: 场景 B PASS
- [ ] intervene.ts --mode=guide: 场景 C PASS
- [ ] intervene.ts --mode=reply-qid: 场景 D PASS
- [ ] intervene.ts mid-turn 行为: 场景 E PASS
- [ ] intervene.ts --mode=abort: 场景 F PASS

### Turn 模型确认
- [ ] prompt_async 不在 turn 中生效（场景 E 证明）
- [ ] question/reply 立即生效（场景 D 证明）
- [ ] abort 立即终止（场景 F 证明）

### 身份保留确认
- [ ] 直发子 session 时 agent 字段保持不变（场景 C 证明）
- [ ] 不传 agent 字段会覆盖为 Orchestrator（负向测试 PASS）
```

---

## Section D: v1.4.0 TodoWrite 监督闭环 E2E 验证

对应 SKILL.md §5 的 `tree-watcher.ts` 脚本。

### D.0 前置条件

- serve daemon 已启动
- SSE daemon 已启动（`bun run scripts/sse-daemon.ts`）
- tree-watcher.ts 编译通过：`bun build scripts/tree-watcher.ts --no-bundle`

### D.1 正常任务观察（L0 observe）

验证 watcher 能观察一个正常执行的 Orchestrator 任务并输出 evidence capsule。

```bash
# 1. 创建 session
SID=$(curl -s -X POST http://localhost:4096/session \
  -H 'Content-Type: application/json' \
  -d '{"agent":"Orchestrator"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "Session: $SID"

# 2. 发送标准任务
curl -s -X POST "http://localhost:4096/session/${SID}/prompt_async" \
  -H 'Content-Type: application/json' \
  -d '{"parts":[{"type":"text","text":"Read the file AGENTS.md and summarize the top 3 architecture layers in one paragraph."}],"agent":"Orchestrator"}'

# 3. 启动 watcher（capsule 模式）
bun run scripts/tree-watcher.ts $SID --interval 5 --timeout 120 --capsule --suggest-guide
```

**预期**：
- [ ] capsule JSON 输出，包含 tree、todoSignals、intervention 字段
- [ ] 正常任务：intervention.level = "L0" 或短暂 "L2"（如果 TodoWrite 延迟）
- [ ] 任务完成后 all-idle 退出（exit 0）

### D.2 TodoWrite 信号检测（L2 guide）

验证 watcher 能检测 quality.jsonl 中的 TodoWrite 异常信号。

```bash
# 1. 创建一个会触发 todo_missing_for_nontrivial 的任务
SID=$(curl -s -X POST http://localhost:4096/session \
  -H 'Content-Type: application/json' \
  -d '{"agent":"Orchestrator"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

# 2. 发送复杂任务（通常会先 dispatch build，build 可能跳过 TodoWrite 直接编辑）
curl -s -X POST "http://localhost:4096/session/${SID}/prompt_async" \
  -H 'Content-Type: application/json' \
  -d '{"parts":[{"type":"text","text":"Modify .opencode/agents/Orchestrator.md: add a comment line at the top saying test-marker-123. Do not use TodoWrite."}],"agent":"Orchestrator"}'

# 3. 启动 watcher（suggest-guide 模式）
bun run scripts/tree-watcher.ts $SID --interval 5 --timeout 120 --suggest-guide
```

**预期**：
- [ ] 如果 build agent 跳过 TodoWrite：watcher 检测到 `todo_missing_for_nontrivial`
- [ ] intervention.level = "L2"，name = "guide"
- [ ] `--suggest-guide` 输出 `bun run intervene.ts <SID> --mode=guide --text="[L2] ..."` 命令
- [ ] （可选）复制命令执行，验证 guidance 被注入

### D.3 Final Gate 验收

验证 watcher 完成后强模型可仅凭 capsule 验收。

```bash
# 在 D.1 或 D.2 完成后，收集最终 capsule
bun run scripts/tree-watcher.ts $SID --interval 3 --timeout 15 --capsule 2>&1 | tail -30
```

**Final Gate 检查清单**：
- [ ] capsule.tree 所有节点 status = "idle"
- [ ] capsule.todoSignals 中的信号已解决（无 pending mismatch/stale）
- [ ] capsule.changedFiles 在 Task Contract scope 内
- [ ] capsule.toolFailures 为空或有合理解释
- [ ] capsule.pendingQuestions 为空
- [ ] 可仅凭 capsule 判定 Accept/Rework/Stop

### D.4 结果汇总模板

```markdown
## tree-watcher E2E 验证报告

**日期**: YYYY-MM-DD

### 场景验证
- [ ] D.1 正常任务观察: PASS（capsule 输出完整，L0/L2 判定正确）
- [ ] D.2 TodoWrite 信号检测: PASS（L2 guide 触发，suggest-guide 命令可用）
- [ ] D.3 Final Gate: PASS（仅凭 capsule 可判定验收）

### 信号覆盖
- [ ] todo_missing_for_nontrivial 可被检测
- [ ] todo_stale_after_tools 可被检测
- [ ] todo_write_mismatch 可被检测
- [ ] session.error → L4 stop-gate
- [ ] pending question → L1 ask
```
