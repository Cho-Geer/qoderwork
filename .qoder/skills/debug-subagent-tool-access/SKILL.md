---
name: debug-subagent-tool-access
description: "诊断修复子 agent 工具访问被阻断问题。六层排查：opencode.json 权限→before-hook 插件→enforcement 豁免→anti-bypass 列表→agent prompt→mode 确认。Diagnose and fix sub-agent tool access blocked issues. 6-layer troubleshooting. Trigger: sub-agent tool access, 工具被阻断, tool deny, before-hook 拦截, permission denied for agent, agent 权限. Not for: 运行时 enforcement chain 阻断 (use opencode-framework-debug)."
version: 1.0.0
---

# Debug Sub-Agent Tool Access

## 适用场景

子 agent（如 Coder-BE、Knowledge-Curator、Coder-FE 等）无法调用特定工具时，使用此技能系统性排查和修复。典型症状：

- agent 调用工具时被 before-hook 拦截，返回 compliance_blocks
- opencode.json 中工具权限设为 deny
- agent prompt 中有 "Do NOT use/call" 约束
- 工具调用在 enforcement chain 中被静默丢弃

**不适用**：运行时五层串行阻断链路问题（dispatch-validate → router → scope-validate → compliance-gate → anti-bypass），请用 `framework-enforcement-debug`。

## 排查流程（6 层，从外到内）

### Phase 1: opencode.json 权限检查

检查目标工具在各 agent 的 tools 段中的 allow/deny 配置。

```bash
# 查找目标工具的所有 deny 配置
grep -n '"<tool_name>".*"deny"' opencode.json

# 查找目标工具的所有 allow 配置
grep -n '"<tool_name>".*"allow"' opencode.json

# 检查特定 agent 的工具权限
python3 -c "
import json
with open('opencode.json') as f:
    cfg = json.load(f)
for agent, tools in cfg.get('agents', {}).items():
    t = tools.get('tools', {}).get('<tool_name>', 'NOT SET')
    print(f'{agent}: {t}')
"
```

**期望**：目标 agent 的工具权限为 `"allow"`。
**异常**：`"deny"` 或缺失。修复为 `"allow"`。

**注意**：opencode.json 中可能有多个 agent 段（Orchestrator、Coder-BE、Coder-FE、Knowledge-Curator、Guardian 等），需逐一检查。

### Phase 2: before-hook 插件排查

检查 `.opencode/plugin-handlers/before/` 下的策略文件，确认是否有硬编码拦截或条件放行逻辑。

```bash
# 列出所有 before-hook 插件
ls .opencode/plugin-handlers/before/

# 搜索目标工具相关的拦截逻辑
grep -rn '<tool_name>' .opencode/plugin-handlers/before/

# 检查策略文件中的 deny/allow/block 逻辑
grep -n 'deny\|allow\|block\|reject\|intercept' .opencode/plugin-handlers/before/<policy-file>.ts
```

**关键检查点**：
- 是否有硬编码的 `return { action: "deny" }` 或 `return { action: "block" }`
- 是否有条件分支（如 `if (agent === "Knowledge-Curator")`）对特定 agent 放行/拦截
- 是否读取了外部配置（如 `exemptions.ts` 的 `isQuestionAllowedForAll()`），该配置是否正确生效
- 插件的 import 路径是否正确指向了实际的服务层文件

**常见陷阱**：before-hook 可能从 `../../service/enforcement/exemptions` 导入配置检查函数。如果该函数不存在或返回值错误，即使 opencode.json 已改为 allow，hook 仍会拦截。

### Phase 3: 豁免配置检查

检查 `project.config.json` 中的豁免列表和服务层配置。

```bash
# 检查 enforcement_exemptions 的三个子列表
python3 -c "
import json
with open('.opencode/project.config.json') as f:
    cfg = json.load(f)
ee = cfg.get('enforcement_exemptions', {})
for key in ['guidance_gate_exempt', 'phase0_failure_exempt', 'initial_read_allowed']:
    tools = ee.get(key, [])
    print(f'{key}: {tools}')
"

# 检查自定义配置段（如 question_policy）
grep -n 'question_policy\|allow_all' .opencode/project.config.json
```

**同时检查服务层**：
```bash
# 检查 exemptions.ts 中是否有对应的配置接口和默认值
grep -n '<config_key>' .opencode/service/enforcement/exemptions.ts

# 确认 loadConfig 合并逻辑是否包含新配置段
grep -A5 'loadConfig' .opencode/service/enforcement/exemptions.ts | grep '<config_key>'
```

**期望**：目标工具出现在所有相关豁免列表中，且服务层函数正确返回 true。

### Phase 4: Prompt 层约束检查

检查 agent .md 文件和共享 preamble 中是否有文本级约束。

```bash
# 检查特定 agent 的 prompt 约束
grep -in 'do not\|don.t\|never\|must not\|禁止' .opencode/agents/<agent-name>.md | grep -i '<tool_name>'

# 检查共享 preamble
grep -in 'do not\|don.t\|never\|must not\|禁止' .opencode/subagent-preamble.md | grep -i '<tool_name>'
```

**修复**：将 "Do NOT use/call" 改为 "You MAY use/call"。

**注意**：prompt 约束是最弱的一层——agent 可能忽略它，但也可能被其他 agent 的 system prompt 覆盖。建议同时修复 prompt 和配置层。

### Phase 5: 修复与重启

修改完成后，执行以下步骤使配置生效：

```bash
# 1. 清除 bun 缓存（TypeScript 编译缓存）
rm -rf /tmp/bun-* 2>/dev/null
rm -rf .opencode/node_modules/.cache 2>/dev/null

# 2. 重启 serve
# 先停止现有 serve 进程
pkill -f 'opencode serve' 2>/dev/null
sleep 2

# 启动 serve
cd /path/to/project && opencode serve --port 4096 &
```

**验证重启成功**：
```bash
# 确认 serve 进程存在
pgrep -af 'opencode serve'

# 确认端口监听
ss -tlnp | grep 4096
```

### Phase 6: serve API 端到端验证

通过 serve API 启动 session 并验证工具调用成功。

```bash
# 1. 创建 session，让 Orchestrator 调度目标 agent
SID=$(curl -s -X POST http://localhost:4096/session \
  -H 'Content-Type: application/json' \
  -d '{"title":"tool-access-test","agent":"Orchestrator"}' | \
  python3 -c 'import sys,json; print(json.load(sys.stdin)["id"])')

# 2. 发送调度指令
curl -s -X POST http://localhost:4096/session/$SID/prompt_async \
  -H 'Content-Type: application/json' \
  -d '{"parts":[{"type":"text","text":"让 <target-agent> 调用 <tool_name> 工具执行: <test_task>"}]}'

# 3. 等待 15-20 秒
sleep 20

# 4. 检查 SSE 事件（工具调用、session 状态）
tail -50 /tmp/sse-events.jsonl | grep $SID | grep -E 'session.idle|session.error|message.updated'

# 5. 检查回复
curl -s "http://localhost:4096/session/$SID/message?limit=3"

# 6. 检查 pending questions（如有）
curl -s http://localhost:4096/question

# 7. 如有 question，回复
curl -s -X POST http://localhost:4096/question/$QID/reply \
  -H 'Content-Type: application/json' \
  -d '{"answers":[["option-label"]]}'

# 8. 最终确认
tail -30 /tmp/sse-events.jsonl | grep $SID | grep 'session.idle'
```

**成功标准**：
- SSE 事件中出现 `session.idle`（agent 正常完成）
- 回复消息中无 compliance_blocks 或 enforcement 错误
- `GET /question` 无 pending question（或已回复后清空）

**失败排查**：
- 如果仍被阻断，回到 Phase 2 检查 before-hook 是否加载了最新代码
- 如果路由到错误 agent，检查任务描述中的关键词（"test/check" → Guardian，"implement/code" → Coder-BE）
- 如果触发 anti-bypass gate，需要查询 guidance_token 并调用 clear_guidance

## 常见陷阱

### 多层阻断
修了 opencode.json 但 before-hook 仍拦截。必须同时检查 Phase 1-4 所有层。

### 字符串匹配误判
自动化脚本中 `"exemptions"` 可能匹配到 `"enforcement_exemptions"` 字符串，导致误判为"已存在"。用精确匹配（如完整 import 路径）而非子串匹配。

### 路由关键词冲突
任务描述中的关键词影响 Orchestrator 的 agent 路由：
- "test/check/verify" → 路由到 Guardian
- "implement/code/build/develop" → 路由到 Coder-BE
- "analyze/why/how" → 路由到 Meta-Planner

如果目标是让 Coder-BE 调用工具，任务描述中避免使用 "test" 类关键词。

### guidance_token 门禁
连续 3 次 dispatch 失败后，anti-bypass gate 会锁定。需要：
1. 从 DB 查询 guidance_token：`SELECT guidance_token FROM tool_enforcement WHERE awaiting_guidance=1`
2. 通过 `curl POST /session/$SID/prompt_async` 下发 clear_guidance 指令（消息内容包含 token）
3. 等待 agent 调用 clear_guidance 解除锁定

### 配置段遗漏
新增配置段（如 `question_policy`）时需同时修改：
- `project.config.json`（数据）
- `exemptions.ts` 接口定义（类型）
- `exemptions.ts` DEFAULT_CONFIG（默认值）
- `exemptions.ts` loadConfig 合并逻辑（运行时加载）
- 策略文件中的读取函数（消费端）

漏掉任何一步都会导致配置不生效。

## 与其他 skill 的关系

- **framework-enforcement-debug**：运行时五层链路阻断（dispatch-validate → router → scope-validate → compliance-gate → anti-bypass）→ 用那个
- **anti-bypass-e2e-testing**：验证 anti-bypass 机制本身（软/硬阈值、guidance_token 恢复）→ 用那个
- **opencode-hook-verification**：验证 hook 触发顺序和实际行为 → 用那个
- **本 skill**：配置层工具权限排查（opencode.json + before-hook + 豁免 + prompt）→ 用这个
