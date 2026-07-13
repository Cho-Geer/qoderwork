---
name: serve-api
description: "通过 serve API (localhost:4096) + SSE 守护进程直接与 OpenCode 交互的操作手册。覆盖 session 生命周期、消息发送、事件轮询(SSE JSONL)、question 检测与回复、session 树查询、子 agent 监控、主动干预。Trigger: serve API, curl, SSE daemon, session 操作, question 回复, 直连 OpenCode, session 验证, session 树, 子 agent 监控, 主动干预, turn 状态. Not for: ACP bridge 功能开发, anti-bypass 专项测试."
version: 1.4.1
---

# Serve API 交互验证与事件测试套件

整合 serve API 直调操作、session 能力端到端验证、事件覆盖验证三大流程。详细测试步骤见 [reference.md](./reference.md)。

> **角色定位**: serve-api 是 `[VERIFICATION]` 技能。它的全部价值在于**与真实运行态交互并产生运行态证据**。
> 使用本技能意味着你在做「验证」而非「分析」——每次 serve API 调用后，必须记录可引用的证据。
>
> **与 pre-flight-enforcement 配合**: 当与 pre-flight-enforcement 组合使用时，serve-api 的步骤应标注为 `[VERIFICATION]`。
> 每个 serve API 调用完成后，必须输出 `Verified-by:` 证据行（session ID、curl 返回摘要、日志行号）。
> 如果写不出证据行，说明该步骤未实际执行。
>
> **为什么源码分析不能替代 serve API 验证**: 源码分析回答的是「代码意图是什么」，serve API 真实触发回答的是「运行态实际是什么」。
> 两者可能不一致（配置覆盖、handler 跳过、已修复 bug 但注释未更新、条件分支未覆盖等）。
> serve API 验证不是源码分析的冗余——它是唯一能发现「代码意图 vs 运行态行为」差距的手段。

## 1. Serve API 直调操作

完全不依赖 ACP bridge MCP server，通过 curl 直调 serve API + SSE 守护进程实现与 OpenCode 的全部交互。

### 架构

```
QoderWork Bash → curl → serve API (localhost:4096)
QoderWork Bash/Read → tail → /tmp/sse-events.jsonl
                                ↑
              setsid bun sse-daemon.ts (独立进程, 非 MCP)
                                ↑
              opencode serve (由 start-serve.ts 启动)
```

### 启动 opencode serve

使用 `qoderwork/scripts/start-serve.ts` 脚本启动，自动完成：加载 .env、清理 bun 缓存、启动 serve daemon。

```bash
# 默认启动（端口 4096，自动检测 work-one 目录）
bun run /home/zhaoge/workspace/qoderwork/scripts/start-serve.ts

# 自定义端口
bun run /home/zhaoge/workspace/qoderwork/scripts/start-serve.ts --port 5000

# 跳过 bun 缓存清理
bun run /home/zhaoge/workspace/qoderwork/scripts/start-serve.ts --no-cache

# 指定 work-one 目录
bun run /home/zhaoge/scripts/start-serve.ts --work-dir /path/to/work-one
```

**WSL 下从 Windows 调用**：
```cmd
wsl.exe -d Ubuntu-24.04 -- bash -c "cd /home/zhaoge/workspace/qoderwork && bun run scripts/start-serve.ts"
```

**脚本路径**：`/home/zhaoge/workspace/qoderwork/scripts/start-serve.ts`
**.env 路径**：`/home/zhaoge/workspace/qoderwork/scripts/.env`（自动加载）

**改完 opencode.json 后必须重启**：serve daemon **不热重载** `opencode.json`。任何对该文件的修改（agent model / permission / skills / prompt 路径）后都要执行 `bun run scripts/start-serve.ts --stop && bun run scripts/start-serve.ts`，否则新 session 仍按旧 config 跑，且子 agent 找不到 model 时会静默降级到 flash（详见 §4.6 Pitfall "opencode.json 变更不热重载"）。

### SSE 守护进程管理

#### 启动
```bash
wsl.exe -d Ubuntu-24.04 -- bash -c "export PATH=/home/zhaoge/.bun/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin; setsid bun run /home/zhaoge/workspace/qoderwork/scripts/sse-daemon.ts > /tmp/sse-daemon.log 2>&1 < /dev/null &"
```

#### 检查状态
```bash
wsl.exe -d Ubuntu-24.04 -- bash -c "ps aux | grep sse-daemon | grep -v grep"
```

#### 查看日志
```bash
wsl.exe -d Ubuntu-24.04 -- bash -c "cat /tmp/sse-daemon.log"
```

#### 重启
```bash
wsl.exe -d Ubuntu-24.04 -- bash -c "pkill -f sse-daemon 2>/dev/null; sleep 1; export PATH=/home/zhaoge/.bun/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin; setsid bun run /home/zhaoge/workspace/qoderwork/scripts/sse-daemon.ts > /tmp/sse-daemon.log 2>&1 < /dev/null &"
```

> **⚠️ curl 无法连接 /event endpoint**：`curl -N -s http://localhost:4096/event` 会无限挂起（即使带 `Accept: text/event-stream` header）。serve API 的 SSE 流只能通过 Bun `fetch()` 可靠连接。**sse-daemon.ts 是 SSE 监控的唯一方式**，不能用 raw curl 替代。

### 核心操作 (全部 curl，零 MCP 依赖)

#### 快速参考

| # | 操作 | 命令 | 证据产出 |
|---|------|------|---------|
| 1 | 创建 Session | `POST /session` | `Verified-by: session ID = <返回的 id>` |
| 2 | 发送消息(同步) | `POST /session/{SID}/message` | `Verified-by: agent 回复摘要 + info.modelID` |
| 2b | 发送消息(异步) | `POST /session/{SID}/prompt_async` | `Verified-by: 异步已提交，后续通过 SSE 或 GET message 获取结果` |
| 3 | 读取回复 | `GET /session/{SID}/message?limit=N` | `Verified-by: 消息列表 + 最新 assistant 文本前 200 字` |
| 4 | 读取事件 | `tail /tmp/sse-events.jsonl` | `Verified-by: 事件类型 + session ID 过滤结果行数` |
| 5 | 检查 Questions | `GET /question` | `Verified-by: pending question 数量 + 各 session ID` |
| 6 | 回复 Question | `POST /question/{QID}/reply` | `Verified-by: 返回 true + 被回复的 QID` |
| 7 | 终止 Session | `POST /session/{SID}/abort` | `Verified-by: 返回 true + 终止的 SID` |
| 8 | 列出 Sessions | `GET /session` | `Verified-by: session 列表 + 各 session 的 agent/title` |
| 9 | 获取子 Sessions | `GET /session/{SID}/children` | `Verified-by: children 列表 + 各 child 的 agent` |
| 10 | Session 状态 | `GET /session/status` | `Verified-by: 状态信息摘要` |

**证据规则**: 每次 serve API 调用后，必须记录 `Verified-by:` 证据行。证据行应包含：
- 调用的端点和方法（如 `POST /session`）
- 返回的关键信息（session ID、错误消息、状态等）
- 如果是错误响应，记录完整错误信息而非摘要

如果写不出证据行，说明该步骤未实际执行，必须补做。

#### 详细用法

**1. 创建 Session**
```bash
curl -s -X POST http://localhost:4096/session \
  -H 'Content-Type: application/json' \
  -d '{"title":"Task Title","agent":"Orchestrator"}'
# 返回: {"id":"ses_xxx", ...}
# ⚠️ agent 字段必填，不传则写入 "unknown" 导致身份断链
# 证据: Verified-by: POST /session → session ID = ses_xxx, agent = Orchestrator
```

**2. 发送消息（同步 vs 异步）**
```bash
# 同步：阻塞到 agent 完成后返回，适合短任务
curl -s -X POST http://localhost:4096/session/{SID}/message \
  -H 'Content-Type: application/json' \
  -d '{"parts":[{"type":"text","text":"Your message"}]}'
# 证据: Verified-by: POST /session/{SID}/message → agent 回复摘要 + info.modelID

# 异步：立即返回，agent 在后台处理，适合长任务 + 轮询
curl -s -X POST http://localhost:4096/session/{SID}/prompt_async \
  -H 'Content-Type: application/json' \
  -d '{"parts":[{"type":"text","text":"Your message"}]}'
# 证据: Verified-by: POST /session/{SID}/prompt_async → 异步已提交，后续通过 SSE 或 GET message 获取结果
```

**3. 读取 Agent 回复**
```bash
# 获取最近 N 条消息
curl -s "http://localhost:4096/session/{SID}/message?limit=5"

# 提取最新 assistant 回复文本
curl -s "http://localhost:4096/session/{SID}/message?limit=1" | \
  python3 -c "import sys,json; msgs=json.load(sys.stdin); parts=msgs[0]['parts'] if msgs else []; [print(p.get('text','')) for p in parts if p.get('type')=='text']"
# 证据: Verified-by: GET /session/{SID}/message?limit=N → 返回 N 条消息，最新 role=assistant 文本前 200 字

**4. 读取事件 (SSE JSONL)**
```bash
tail -50 /tmp/sse-events.jsonl                    # 最近事件
tail -200 /tmp/sse-events.jsonl | grep "ses_XXX"  # 按 session 过滤
tail -200 /tmp/sse-events.jsonl | grep "question.asked"  # 按类型过滤

# 统计事件类型
tail -100 /tmp/sse-events.jsonl | python3 -c "
import sys,json,collections
c=collections.Counter(json.loads(l)['type'] for l in sys.stdin if l.strip())
[print(f'  {t}: {n}') for t,n in c.most_common()]"
# 证据: Verified-by: tail /tmp/sse-events.jsonl → 过滤后 X 行，事件类型包括 [类型列表]
```

**5. 检查 Pending Questions**
```bash
curl -s http://localhost:4096/question
# 返回: [{"id":"que_xxx","sessionID":"ses_xxx","questions":[{"question":"...","options":[...]}]}]

# 格式化显示
curl -s http://localhost:4096/question | python3 -c "
import sys,json
questions = json.load(sys.stdin)
for q in questions:
    print(f'  {q[\"sessionID\"][:20]}... | {q[\"questions\"][0][\"question\"][:60]}...')"
# 证据: Verified-by: GET /question → X 个 pending question，涉及 session [SID 列表]
```

**6. 回复 Question**
```bash
# ⚠️ 格式：数组套数组 [["option-label"]]，不是对象
curl -s -X POST http://localhost:4096/question/{QID}/reply \
  -H 'Content-Type: application/json' \
  -d '{"answers":[["option-label"]]}'
# 返回: true
# 证据: Verified-by: POST /question/{QID}/reply → true，已回复 QID
```

**7-10. Session 管理**
```bash
curl -s -X POST http://localhost:4096/session/{SID}/abort       # 终止
# 证据: Verified-by: POST /session/{SID}/abort → true，已终止 SID

curl -s http://localhost:4096/session                            # 列出所有
# 证据: Verified-by: GET /session → X 个 session，包括 [SID 列表]

curl -s "http://localhost:4096/session/{SID}/children"           # 子 sessions
# 证据: Verified-by: GET /session/{SID}/children → X 个 child，agent 为 [agent 列表]

curl -s http://localhost:4096/session/status                     # 状态
# 证据: Verified-by: GET /session/status → [状态摘要]
```

### Agent 完成检测

**方法 1：JSONL 事件检测**
```bash
tail -100 /tmp/sse-events.jsonl | grep "session.idle" | grep "ses_XXXXX"
tail -100 /tmp/sse-events.jsonl | grep "session.error" | grep "ses_XXXXX"
```

**方法 2：REST 补漏（每 30s，防 SSE 断连丢事件）**
```bash
curl -s "http://localhost:4096/session/{SID}/message?limit=1"
```

**方法 3：question 检测**
```bash
curl -s http://localhost:4096/question | python3 -c "
import sys,json
questions = json.load(sys.stdin)
for q in questions:
    print(f'  {q[\"sessionID\"][:20]}... | {q[\"questions\"][0][\"question\"][:60]}...')
"
```

### 并行 Sub-Agent 交互流程

```
Step 1: 发消息给 Orchestrator 触发 dispatch
  curl -s -X POST localhost:4096/session/{ORCH_ID}/message -d '...'

Step 2: 检测子 session 创建
  tail -100 /tmp/sse-events.jsonl | grep "session.created"
  curl -s localhost:4096/session/{ORCH_ID}/children

Step 3: 并行轮询各子 session 的事件
  for SID in ses_KC ses_MP ses_SA; do tail -50 /tmp/sse-events.jsonl | grep $SID; done

Step 4: 检测到 question → 回复
  curl -s localhost:4096/question
  curl -s -X POST localhost:4096/question/{ID}/reply -d '...'

Step 5: 检测完成
  tail JSONL | grep "session.idle.*ses_KC"
  curl -s localhost:4096/session/ses_KC/message?limit=1
```

### 双保险事件读取（防 SSE 断连丢事件）

```bash
# 主路径：SSE JSONL 文件（实时，1-2s 延迟）
tail -50 /tmp/sse-events.jsonl | grep "ses_XXXXX"

# 补漏路径：REST 查询（每 30s 一次，兜底）
curl -s "http://localhost:4096/session/ses_XXXXX/message?limit=5"
```

### SSE 事件归档

SSE daemon 内置每小时自动归档：
- 当前文件：`/tmp/sse-events.jsonl`
- 归档目录：`/tmp/sse-events-archive/`
- 归档命名：`sse-events-YYYY-MM-DDTHH.jsonl`
- 溢出保护：文件超 10MB 时立即归档

```bash
ls -la /tmp/sse-events-archive/
grep "ses_XXXXX" /tmp/sse-events-archive/*.jsonl
```

### 直调 Pitfalls

- **serve API 地址**：默认 `http://localhost:4096`，serve 重启需确认端口
- **SSE daemon 崩溃**：用 `ps aux | grep sse-daemon` 检查，`setsid` 重启
- **JSONL 文件管理**：daemon 自动每小时归档，溢出保护 10MB，无需手动管理
- **question 回复时机**：`GET /question` 返回所有 session 的 pending questions，按 sessionID 匹配回复
- **源码分析不能替代 serve API 验证**：源码分析回答「代码意图是什么」，serve API 真实触发回答「运行态实际是什么」。两者可能不一致——配置覆盖、handler 跳过、已修复 bug 但注释未更新、条件分支未覆盖等都可能造成差距。**serve API 验证不是源码分析的冗余，而是唯一能发现「意图 vs 行为」差距的手段。**

### 验证完成检查清单

每次使用 serve-api 技能完成一轮验证后，检查以下各项：

- [ ] **session ID 已记录**：每个创建的 session 的 ID 已保存
- [ ] **每个 VERIFICATION 步骤有证据行**：格式 `Verified-by: <端点> → <关键返回信息>`
- [ ] **错误信息完整**：如果调用被阻断，记录了完整的错误消息（不是摘要）
- [ ] **日志行可引用**：如果需要，能从 `/tmp/sse-events.jsonl` 或 `.task_temp/_logs/` 中找到对应日志行
- [ ] **与 pre-flight-enforcement 的 audit 对齐**：audit 中的证据行与本检查清单一致

### Windows/WSL 调用模式

当 QoderWork 运行在 Windows 上、serve API 运行在 WSL 内时，curl 命令需要穿过 PowerShell -> `wsl.exe` -> `bash -c` 三层。这会导致 **quoting 冲突** 和 **Unicode 编码问题**。以下三种模式按场景选用：

#### 模式 A：简单命令（无 JSON payload）

适合 `GET /session`、`GET /question`、`tail` 等不含 JSON body 的操作。用双引号包裹 bash 命令，内部用单引号：

```powershell
wsl -d Ubuntu-24.04 bash -c "curl -s http://localhost:4096/session"
wsl -d Ubuntu-24.04 bash -c "tail -50 /tmp/sse-events.jsonl | grep ses_XXX"
```

#### 模式 B：Invoke-RestMethod（PowerShell 原生，推荐用于含 JSON 的操作）

适合 `POST /session`、`POST /session/{SID}/message` 等含 JSON body 的操作。完全绕过 bash quoting，用 PowerShell 原生 HTTP 客户端：

```powershell
# 创建 session
$response = Invoke-RestMethod -Uri "http://localhost:4096/session" -Method Post `
  -ContentType "application/json; charset=utf-8" `
  -Body '{"title":"test","agent":"Orchestrator"}'
$sid = $response.id

# 发送消息（含中文 -- 必须用 charset=utf-8 避免乱码）
$body = @{ parts = @(@{ type = "text"; text = "尝试执行 gh issue create" }) } | ConvertTo-Json -Depth 5
$bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
Invoke-RestMethod -Uri "http://localhost:4096/session/$sid/message" -Method Post `
  -ContentType "application/json; charset=utf-8" -Body $bytes
```

> **⚠️ Unicode 编码**：PowerShell `ConvertTo-Json` 默认可能将中文编码为 `\uXXXX` 或乱码。必须：
> 1. Content-Type 加 `charset=utf-8`
> 2. 用 `[System.Text.Encoding]::UTF8.GetBytes($body)` 转为字节数组再传递
> 3. 不要用 `ConvertTo-Json | Out-String` 链式调用（会引入 BOM）

#### 模式 C：写 JSON 到文件再 curl -d @file（最可靠）

适合复杂 JSON payload 或需要管道处理的场景。先在 WSL 内写 JSON 文件，再用 `curl -d @file` 读取：

```bash
# 1. 在 WSL 内写 JSON 文件
wsl -d Ubuntu-24.04 bash -c 'cat > /tmp/msg.json << '"'"'EOF'"'"'
{"parts":[{"type":"text","text":"尝试执行 gh issue create --repo microsoft/vscode"}]}
EOF'

# 2. 用 curl -d @file 发送
wsl -d Ubuntu-24.04 bash -c "curl -s -X POST http://localhost:4096/session/$SID/message -H 'Content-Type: application/json' -d @/tmp/msg.json"
```

#### 模式 D：Python 脚本统一执行（推荐用于 E2E 测试）

复杂 E2E 测试场景中，将完整测试逻辑写成 Python 脚本放在 WSL 本地路径，避免所有 quoting 问题：

```bash
# 1. 将脚本放在 WSL 本地路径（不经过 Windows 文件系统）
#    路径示例: /home/zhaoge/workspace/qoderwork/scripts/e2e-test.py

# 2. 执行
wsl -d Ubuntu-24.04 bash -c "export PATH='/home/zhaoge/.bun/bin:/usr/local/bin:/usr/bin:/bin' && python3 /home/zhaoge/workspace/qoderwork/scripts/e2e-test.py"
```

**选择规则**：

| 场景 | 推荐模式 | 原因 |
|------|---------|------|
| GET 请求、tail 日志 | A | 无 JSON body，quoting 简单 |
| POST 含 JSON（英文） | B | PowerShell 原生，最简洁 |
| POST 含 JSON（中文） | B + UTF8 编码 | 必须处理 Unicode |
| 复杂管道、多步 E2E | C 或 D | 完全避免 quoting 层叠 |
| 需要可复现的 E2E 测试 | D | 脚本化，可版本控制 |

---

## 2. Session 能力端到端验证

通过 serve API 直调逐条实测全部 session 级能力，输出 PASS/FAIL 覆盖率报告。

**核心目的**：blueprint 可能声称 100% 覆盖，但如果不实际执行，缺失的能力不会被发现。

### 前置条件

- WSL 环境、opencode 二进制、sqlite3、curl/jq

**路径变量约定**：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PROJECT_DIR` | `/home/zhaoge/workspace/opencode/work-one` | OpenCode 框架项目目录 |
| `PORT` | `4096` | serve API 监听端口 |
| `FRAMEWORK_DB` | `$PROJECT_DIR/.opencode/state/framework-state.db` | 框架状态数据库 |
| `SDK_DB` | `$PROJECT_DIR/.opencode/state/opencode.db` | SDK 数据库 |

### 13 项验证清单

| # | 能力 | 操作 | 关键步骤 |
|---|------|------|---------|
| 1 | session 创建 | `POST /session` | 创建 session + 验证返回 |
| 2 | session_map 注册 | DB 手动 INSERT | 检查 session_map → 手动 INSERT（如缺失） |
| 3 | 消息发送 | `POST /session/{SID}/message` | 发送只读任务，验证 agent 响应 |
| 4 | SSE 事件 | `tail /tmp/sse-events.jsonl` | 验证事件非空、类型正确 |
| 5 | question 检测 | `GET /question` | 验证 question 事件可达 |
| 6 | guidance 下发 | `POST /session/{SID}/message` | 触发阻断 → 投递 guidance → 验证恢复 |
| 7 | enforcement 重置 | DB UPDATE/DELETE | 清除阻断状态，恢复测试环境 |
| 8 | write 写操作 | `POST /session/{SID}/message` | enforcement 重置后验证写操作 |
| 9 | dispatch 调度 | `POST /session/{SID}/message` + Task | 验证 sub-agent 创建与执行 |
| 10 | question 回复 | `POST /question/{QID}/reply` | 触发提问 → 获取 question → 回复 |
| 11 | session 列表 | `GET /session` | 验证活跃 session 列表 |
| 12 | session 终止 | `POST /session/{SID}/abort` | 终止 session + 验证状态变更 |
| 13 | 超时恢复 | `POST /session/{SID}/prompt_async` | 异步发送后 session 仍在后台运行 |

详细测试步骤见 [reference.md](./reference.md) Section A。

### 覆盖率报告模板

```markdown
## Serve API E2E 验证报告

**日期**: YYYY-MM-DD
**Serve 版本**: <版本号或 commit>
**Serve 端口**: 4096

### 覆盖率汇总
- 总计: 13 项
- PASS: X 项 / FAIL: X 项 / SKIP: X 项
- 覆盖率: X/13 (XX%)

### 与 Blueprint 对比
| Blueprint 声称 | 实际验证 | 差异 |
|---------------|---------|------|
| 100% 覆盖 | X/13 | 缺失: ... |

### FAIL 项详情
（逐项说明失败原因和影响）

### 建议修复优先级
1. P0: ...
2. P1: ...
```

### E2E 验证 Pitfalls

- **session_map 未自动注册**：serve API 创建的 session 可能不被 `session.created` hook 自动注册。guidance/enforcement 不工作时先查 session_map 表
- **enforcement 阻断写操作**：未通过 checklist/attest 时所有非 passthrough 工具被阻断，测试写操作前需先完成 enforcement 重置
- **session 创建超时但已存在**：不要盲目重试，先用 `GET /session` 检查避免重复 session
- **notify-server 不可见**：检查 `mcp-role-filter.ts` 的 `SERVER_PREFIXES` 和 `AGENT_MCP_SERVERS` 配置
- **SSE 事件为空**：确认 SSE daemon 在 session 创建前启动，首次调用可能无历史事件，先发送消息触发 agent 行为
- **WSL 路径问题**：`$` 变量需转义为 `\$`，或使用脚本文件方式避免展开问题
- **PowerShell -> WSL quoting 冲突**：`wsl bash -c "curl -d '{"key":"val"}'"` 中 PowerShell 和 bash 对引号的处理不一致，导致 JSON payload 传递失败。解决方案见上方「Windows/WSL 调用模式」：简单命令用模式 A，含 JSON 用模式 B（Invoke-RestMethod），复杂场景用模式 C 或 D
- **PowerShell Unicode 编码乱码**：PowerShell `ConvertTo-Json` 会将中文编码为 `\uXXXX` 或 `?????????`，导致 `POST /session/{SID}/message` 发送的中文内容乱码。必须用 `[System.Text.Encoding]::UTF8.GetBytes($body)` + `charset=utf-8` Content-Type（见模式 B）
- **复杂 E2E 测试推荐 Python 脚本**：含多步 curl + 管道 + JSON 解析的 E2E 测试，不要试图在 PowerShell -> WSL bash -c 中嵌套实现。将完整逻辑写成 Python 脚本放在 WSL 本地路径（`/home/zhaoge/workspace/qoderwork/scripts/`），通过 `wsl python3 /path/script.py` 执行（见模式 D）

---

## 3. 事件覆盖验证

通过 SSE 后台监听 + DB 查询，端到端验证 serve API 的各类事件（acp_notify、question、message 等）是否正确推送到客户端。

### 前置条件

- WSL 环境、opencode 二进制、curl/jq

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PROJECT_DIR` | `/home/zhaoge/workspace/opencode/work-one` | OpenCode 框架项目目录 |
| `PORT` | `4096` | serve API 监听端口 |
| `TEMP_DIR` | `/tmp/serve-event-test` | 临时文件目录 |
| `SSE_FILE` | `$TEMP_DIR/sse-events.txt` | SSE 事件原始输出文件 |

### 流程概览

```
1. 环境准备 → 确认 opencode 二进制、端口空闲
2. 启动 serve + SSE 后台监听（SSE 必须在 session 创建之前启动）
3. 创建 session
4. 触发 acp_notify 事件（发送含 acp_notify 指令的消息）
5. 触发 question 事件（发送触发 ask_user 的消息）
6. 分析验证（SSE 事件概览 + 逐类型验证 + DB 交叉验证）
7. 清理
```

### SSE 监听启动

```bash
# 启动 serve（使用 start-serve.ts 脚本，自动加载 .env + 清理 bun 缓存）
bun run /home/zhaoge/workspace/qoderwork/scripts/start-serve.ts --port ${PORT}

# 等待 serve 就绪
for i in $(seq 1 10); do
  curl -s http://localhost:${PORT}/api/health >/dev/null 2>&1 && { echo 'serve ready'; break; }
  sleep 1
done

# 启动 SSE 后台监听（必须在 session 创建之前！）
# 注意：不能用 curl 连接 /event（会挂起），必须用 sse-daemon.ts
export PATH=/home/zhaoge/.bun/bin:$PATH
setsid bun run /home/zhaoge/workspace/qoderwork/scripts/sse-daemon.ts > /tmp/sse-daemon.log 2>&1 < /dev/null &
echo $! > ${TEMP_DIR}/sse.pid
```

### 事件触发与分析

详细触发命令和分析脚本见 [reference.md](./reference.md) Section B。

**验证清单**：
- [ ] serve 进程正常运行（PID 有效）
- [ ] SSE 监听进程正常运行
- [ ] session 创建成功（有有效 sessionId）
- [ ] SSE 文件中包含 `event: message` 事件
- [ ] SSE 文件中包含 `event: acp_notify` 事件，且 data 字段非空
- [ ] SSE 文件中包含 `event: question` 事件，且包含 question 结构
- [ ] （可选）DB 中 session 记录存在
- [ ] 三类事件的 data 结构完整、可被 jq 解析

### 事件验证 Pitfalls

- **SSE 文件为空或无事件**：确认 SSE 监听在 session 创建之前启动；检查 serve 进程是否存活
- **acp_notify 事件未出现**：确认 agent 配置支持 acp_notify；检查消息内容是否明确触发通知行为；增加等待时间
- **question 事件未出现**：确认 `ask_user` 工具在 agent 工具集中已注册；检查消息是否引导 agent 使用提问工具
- **serve 端口冲突**：`ss -tlnp | grep :${PORT}` 查看占用进程；更换端口并同步更新 SSE URL
- **jq 解析失败**：SSE data 行可能跨多行，需先合并 `data:` 前缀的行再解析

---

## 通用验证

启动后验证三步（直调模式）：
1. `ps aux | grep sse-daemon` → 进程存在
2. `curl localhost:4096/session` → 返回 session 列表
3. `tail -5 /tmp/sse-events.jsonl` → 有事件数据

---

## 4. 高级能力：Session 树监控与主动干预（v1.3.0 新增）

当主 agent 派遣子 agent 后，QoderWork 需要同时监控主 agent 和所有子 agent，并在需要时区分指导对象。本节引入 **Session 树**作为一等抽象，所有监控与干预操作都基于树而不是单 SID。

蓝图：`qoderwork/blueprints/blueprint-serve-api-session-tree-optimization.md` v1.1

### 4.1 Session 树查询 — `session-tree.ts`

递归查询主 agent 与其所有子孙 session 的树结构。

```bash
# 人类可读树
bun run /home/zhaoge/workspace/qoderwork/scripts/session-tree.ts <ROOT_SID>
# 输出示例：
# ses_0c9798a78ffe4r46ZvYSXZyBWL | Orchestrator | root | sub-session direct messaging test
# └─ ses_0c9792cbaffeVQhM1254ZgYpqR | Orchestrator | child | Read SKILL.md first 20 lines

# JSON 输出（给其他脚本消费）
bun run /home/zhaoge/workspace/qoderwork/scripts/session-tree.ts <ROOT_SID> --json
# 返回: { root, nodes, allIds, leafIds }

# 自定义深度上限和端口
bun run /home/zhaoge/workspace/qoderwork/scripts/session-tree.ts <ROOT_SID> --depth 3 --port 5000
```

**返回字段**：
- `root`：根 SID
- `nodes[sid]`：`{ id, agent, parent, children, title, depth }`
- `allIds`：扁平化 SID 列表（方便 `grep -E`）
- `leafIds`：叶子节点（完成判定用）

**底层 API**（手动场景）：
```bash
curl -s "http://localhost:4096/session/{PARENT_SID}/children"
# 返回 list，每项含 id / parentID / agent / title / time 等
```

### 4.2 全树监控 — `monitor-tree.ts`

同时监控主 agent 和所有子 agent 的状态，自动检测树完成。

```bash
bun run /home/zhaoge/workspace/qoderwork/scripts/monitor-tree.ts <ROOT_SID>
# 每 5s 输出：
# [08:25:00] root=Orchestrator(idle)    | child=build(working) | pending=0
# [08:25:05] root=Orchestrator(working) | child=build(idle)    | pending=1
# [08:25:10] root=Orchestrator(idle)    | child=build(idle)    | pending=0
# [08:25:15] ✓ all idle x2 rounds, tree completed

# 选项：
#   --interval=5       轮询间隔（秒），默认 5
#   --timeout=600      超时（秒），默认 600
#   --on-question URL  检测到 pending question 时 POST webhook
#   --port=4096        serve 端口
```

**4 种 status 枚举**：

| status | 判定条件 | 含义 |
|---|---|---|
| `idle` | 最近 15s 无 `session.time.updated` 且无 pending question | 可发新一轮 prompt_async |
| `working` | 最近 15s 内有 `session.time.updated` | 不要打断，等下一轮 |
| `question-pending` | `GET /question` 含该 SID 的条目 | 优先 `POST /question/{QID}/reply` 立即恢复 |
| `error` | `/session/{sid}` 返回 HTTP 错误 | 需 abort 或人工介入 |

**完成判定**：连续 2 轮（即连续 10s）全节点 idle → 输出 "✓ all idle x2 rounds, tree completed" 并退出 0。

**动态发现**：每轮重跑 session-tree 合并新出现的 child，应对 dispatch 延迟（子 session 不是一次性全部出现）。

### 4.3 主动干预工具矩阵

| 工具 | 调用方式 | 是否阻塞 agent | 生效时机 | 推荐场景 |
|---|---|---|---|---|
| `POST /session/{SID}/message` | 同步 HTTP | 阻塞到 agent 完成后返回 | agent 开始新一轮 | 同步等待结果 |
| `POST /session/{SID}/prompt_async` | 异步 HTTP | 立即返回 | 排入队列，下一 turn 开始 | 长任务 + 轮询 |
| `POST /question/{QID}/reply` | 同步 HTTP | 立即返回 | **立即恢复**被 question 暂停的 agent | question 回复 |
| `POST /session/{SID}/abort` | 同步 HTTP | 立即终止 | 立即 | 止损 |

**关键事实（OpenCode 是 turn-based）**：
- `prompt_async` 只在 **turn 边界**生效，agent 正在跑 tool 时注入不会立即生效
- `question/reply` 是**唯一**能在 turn 中立即生效的工具（agent 必须主动调用 question 工具暂停）
- 详见 §4.5 "Turn 模型与生效点"

### 4.4 身份保留指导 — `guide.ts` 与 `intervene.ts`

**Pitfall（显式警告）**：直发消息给子 session 时**必须**传 `agent` 字段，否则子 session 的真实 agent 身份会被 serve API 覆盖为 `Orchestrator`（v1.17.13 实测）。

```bash
# ✗ 错误写法（身份被覆盖）
curl -X POST http://localhost:4096/session/{SID}/prompt_async \
  -d '{"parts":[{"type":"text","text":"..."}]}'

# ✓ 正确写法（身份保留）
curl -X POST http://localhost:4096/session/{SID}/prompt_async \
  -H 'Content-Type: application/json' \
  -d '{"parts":[{"type":"text","text":"..."}], "agent":"<SID 真实 agent>"}'
```

**推荐脚本**（自动查 SID 真实 agent + 身份保留发送）：

```bash
# guide.ts — 轻量指导发送
bun run /home/zhaoge/workspace/qoderwork/scripts/guide.ts <SID> "<guidance text>"
bun run /home/zhaoge/workspace/qoderwork/scripts/guide.ts <SID> "<text>" --sync --timeout=60

# intervene.ts — 统一入口，覆盖 4 种 mode
bun run /home/zhaoge/workspace/qoderwork/scripts/intervene.ts <SID> --mode=guide --text="..."
bun run /home/zhaoge/workspace/qoderwork/scripts/intervene.ts <SID> --mode=reply-qid <QID> --text="..."
bun run /home/zhaoge/workspace/qoderwork/scripts/intervene.ts <SID> --mode=abort
bun run /home/zhaoge/workspace/qoderwork/scripts/intervene.ts <SID> --mode=status
```

**指导路由规则**（按 question.sessionID 路由）：
1. `GET /question` 拿到所有 pending questions，每条含 `sessionID`
2. 用 `session-tree.ts` 反查该 SID 是 root 还是 child
3. **SID 是 root** → `intervene.ts --mode=reply-qid` 回复给主 agent（agent="Orchestrator"）
4. **SID 是 child** → `intervene.ts --mode=reply-qid` 直发给子 session（agent=child 真实 agent）
5. **禁忌**：看到 child 的 question 却给父发 guidance（父无法替子回答）；同时给父子发同一条 guidance（重复干扰）

### 4.5 Turn 模型与生效点

OpenCode 是 turn-based（回合制），不是流式可中断的。一个 turn 的结构：

```
用户消息到达
   ↓ [Turn 开始]
system prompt 构造（含 skill-summary 注入）
   ↓
LLM 推理 → 决定 tool calls
   ↓
tools 顺序执行（read/write/bash/...）
   ↓
LLM 看到 tool results → 继续推理
   ↓
可能继续 tool calls（循环）
   ↓
LLM 输出最终 text，无 tool calls
   ↓ [Turn 结束] → session.idle
```

**各工具在 turn 中的生效位置**：

```
                ┌─ prompt_async 消息入队 ─┐
                │                          ↓
Turn N:  [system][LLM][tool][tool][LLM][text] → idle
                                                    ↓
Turn N+1:[system 重读队列][LLM 看到新消息][tool]...
                ↑
                └─ prompt_async 实际生效的位置

question/reply 特殊（agent 必须主动调 question 工具暂停）：
Turn N:  [LLM][tool:question][暂停]───等待 reply───[继续][tool][text] → idle
                                    ↑              ↑
                                 reply 到达 ─── 立即恢复
```

**关键事实**：
1. `prompt_async` 在**下一轮 turn 开始**生效，不是立即
2. `question/reply` 在**当前 turn 内立即**生效（agent 被 question 工具主动暂停）
3. `abort` **立即**生效（终止当前 turn）
4. Mid-turn 无法注入：agent 正在跑 tool 时任何 prompt_async 都进不去
5. 子 agent 的 turn 独立于父 agent：给 child 发 prompt_async 在 child 的下一 turn 生效

### 4.6 v1.3.0 新增 Pitfalls

- **agent 身份覆盖**：直发消息必须传 agent 字段（§4.4），否则子 session 身份被覆盖为 Orchestrator
- **mid-turn 注入不可行**：agent 正在跑 tool 时无法注入（§4.5），必须等 turn 边界；要立即生效需诱导 agent 主动调 question 工具
- **dispatch 延迟**：子 session 不是一次性全部出现，`monitor-tree.ts` 默认每 5s 重新扫描以捕获新 child
- **SSE 断连**：仍保留 REST 补漏路径（monitor-tree 已内置 `session.time.updated` 检测作为 SSE 兜底）
- **嵌套孙 agent**：`session-tree.ts --depth` 默认 5，更深要手动介入
- **`GET /children` 返回 HTML**：历史上曾出现，v1.17.13 已修复返回 JSON array；若再次出现，参考蓝图中 SDK DB / SSE / framework DB fallback 路径
- **opencode.json 变更不热重载**：`opencode.json` 是 agent↔model 映射的**唯一权威源**（每个 agent 的 `model` 字段决定该 agent 实际跑哪个 model，主/子 agent 各自独立），但 **serve daemon 不会热重载该文件**。任何修改（改 model、改 permission、改 agent 配置）后**必须**执行：
  ```bash
  bun run /home/zhaoge/workspace/qoderwork/scripts/start-serve.ts --stop
  bun run /home/zhaoge/workspace/qoderwork/scripts/start-serve.ts
  ```
  否则新 session 仍按旧 config 跑，且子 agent 找不到配置的 model 时会**静默降级**到 flash（实测 build 配 pro 但 daemon 未重启时实际跑 flash）。
- **先查再发（identity-preserve pattern）**：直发消息给任何 SID 前，**必须**先读该 SID 的真实 agent，再用该 agent 调 `prompt_async`。三步标准流程：
  ```bash
  # 1. 读真实 agent
  AGENT=$(curl -s "http://localhost:4096/session/${SID}" \
    | python3 -c "import sys,json; print(json.load(sys.stdin)['agent'])")
  # 2. 带 agent 字段发送
  curl -s -X POST "http://localhost:4096/session/${SID}/prompt_async" \
    -H 'Content-Type: application/json' \
    -d "{\"parts\":[{\"type\":\"text\",\"text\":\"...\"}], \"agent\":\"${AGENT}\"}"
  ```

---

## 5. TodoWrite 驱动的监督闭环（v1.3.0 新增）

`tree-watcher.ts` 在 monitor-tree 基础上增加 SSE 事件和 quality.jsonl 观察，输出 **evidence capsule** 和 **L0-L4 干预建议**，实现弱模型自治 + 强模型关键监督。

蓝图：`qoderwork/blueprints/blueprint-todowrite-driven-weak-agent-supervision.md`

### 5.1 tree-watcher.ts — 自动观察器

```bash
# 基本用法：状态行 + 干预标签
bun run scripts/tree-watcher.ts <ROOT_SID> --interval 5 --timeout 300

# 输出 evidence capsule JSON（适合强模型消费）
bun run scripts/tree-watcher.ts <ROOT_SID> --capsule

# 输出可复制的 intervene.ts 命令（L2+ 时）
bun run scripts/tree-watcher.ts <ROOT_SID> --suggest-guide
```

### 5.2 信号来源

| 来源 | 文件/端点 | 观察内容 |
|------|----------|---------|
| Session tree | `GET /session`, `/children` | 节点状态（idle/working/question-pending/error） |
| SSE events | `/tmp/sse-events.jsonl` | session.created, session.error, tool.failed, file.edited |
| Quality JSONL | `.task_temp/_logs/quality.jsonl` | todo_missing, todo_stale, todo_mismatch, todo_failure |
| Questions | `GET /question` | pending questions by session |

### 5.3 干预等级

| 等级 | 名称 | 触发条件 | 行为 |
|------|------|---------|------|
| L0 | observe | 正常推进 | 不输出干预 |
| L1 | ask | pending question | 建议回复 question |
| L2 | guide | TodoWrite stale/missing/mismatch | 输出 intervene.ts guide 命令 |
| L3 | redirect | blocked >= 2 且无 recovery | 建议停止当前路径 |
| L4 | stop-gate | session error / 连续 tool failure | 建议 abort |

### 5.4 标准监督流程

```
1. 启动 serve + SSE daemon
2. 创建 Orchestrator session（发送 Task Contract）
3. 启动 tree-watcher：bun run scripts/tree-watcher.ts <SID> --capsule --suggest-guide
4. 观察 evidence capsule：todoSignals 为空 = L0，有信号 = L2+
5. 如需干预：复制 watcher 输出的 intervene.ts 命令执行
6. 任务完成后：按 final gate 验收 capsule 中的 changedFiles + toolFailures
```
  或直接用 `intervene.ts --mode=guide` / `guide.ts`，两步合并为一步自动处理。**禁止**在不查 agent 的情况下裸写 `prompt_async`。
- **model 验证**：发完消息后用 `GET /session/{SID}/message?limit=1` 读 `info.modelID` / `info.providerID` 字段可当场确认实际跑的 model，发现与 `opencode.json` 不一致时立即怀疑 daemon 未重启。
