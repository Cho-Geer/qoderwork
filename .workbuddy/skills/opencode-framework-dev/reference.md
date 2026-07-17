# OpenCode Framework Dev Suite — Reference

本文件存放 `SKILL.md` 各章节的详细内容：完整代码示例、SQL 模板、根因模式详解、日志事件代码表、报告模板等。SKILL.md 中标注 "见 reference.md" 的内容均在此文件中。

## Current Truth Overlay (2026-07-07)

本文件包含历史模板。执行前必须优先采用 `SKILL.md` 的 current truth snapshot。以下覆盖规则优先级最高：

- 当前 active agent key 是 `Orchestrator`, `build`, `general`, `explore`, `plan`；旧角色 `Architect/Coder-BE/Super-Admin/...` 只是 legacy profile 或历史文档语境，不能直接作为 `opencode.json.agent` 修改目标。
- 当前 `.opencode/agents/` 只有 `Orchestrator.md`；native `build/general/explore/plan` 没有对应 agent md。
- 当前 active plugin 入口是 5 个 dispatcher/lifecycle 文件：`before-dispatcher.ts`, `after-dispatcher.ts`, `system-dispatcher.ts`, `session.ts`, `tool-def-trimmer.ts`。
- 当前验证默认用 serve API；ACP token 测量只作为上游协议研究或 context baseline 选项，不是默认 E2E。
- 当前环境是本地 WSL，优先直接执行 bash 命令；不要机械套 `wsl.exe -d Ubuntu-24.04`。
- `safe_framework_edit` 当前只应按显式 permission + `dispatch_privilege` grant + CodeGraph double gate 验证。

---

## §1.1 Plugin Handler 加日志完整代码示例

### before-hook 示例

```typescript
// plugin-handlers/before/checklist.ts
import { writeLog } from "../../lib/log-manager";

export async function handle(input: any, output: any): Promise<void> {
  writeLog("checklist-before", "runtime", {
    event: "[CHECKLIST-BEFORE] HANDLER-ENTERED",
    detail: `tool=${input?.toolName}`,
    sessionID: input?.sessionID,
  });

  // ... 业务逻辑 ...

  if (blocked) {
    writeLog("checklist-before", "runtime", {
      event: "[CHECKLIST-BEFORE] BLOCKED",
      detail: reason,
      sessionID: input?.sessionID,
    });
    throw new Error(`[FW-CHECKLIST] Tool "${toolName}" blocked`);
  }

  writeLog("checklist-before", "runtime", {
    event: "[CHECKLIST-BEFORE] PASSED",
    sessionID: input?.sessionID,
  });
}
```

### after-hook 示例

```typescript
// plugin-handlers/after/audit.ts
import { writeLog } from "../../lib/log-manager";

export async function handle(input: any, output: any): Promise<void> {
  writeLog("audit-after", "runtime", {
    event: "[AUDIT-AFTER] HANDLER-ENTERED",
    detail: `tool=${input?.toolName}`,
    sessionID: input?.sessionID,
  });
  // ... 业务逻辑 ...
}
```

### 确认 handler 是否被加载

在 handler 注册处加日志：

```typescript
// .opencode/plugins/before-dispatcher.ts
import { handle as checklistHandle } from "./before/checklist";
import { writeLog } from "../lib/log-manager";
writeLog("before-dispatcher", "runtime", { event: "[BEFORE-DISPATCHER] LOADED: checklist handler" });
```

---

## §1.2 跑测试 session 完整脚本

### 方式 A：通过 serve API 启动新 session

```bash
SID=$(curl -s -X POST http://localhost:4096/session \
  -H 'Content-Type: application/json' \
  -d '{"title":"debug-test","agent":"Orchestrator"}' | \
  python3 -c 'import sys,json; print(json.load(sys.stdin)["id"])')
echo "Session: $SID"

curl -s -X POST http://localhost:4096/session/$SID/prompt_async \
  -H 'Content-Type: application/json' \
  -d '{"parts":[{"type":"text","text":"执行 bash 命令: echo hello"}]}'
```

### 方式 B：向已有 session 发消息

```bash
curl -s -X POST http://localhost:4096/session/SESSION_ID_HERE/prompt_async \
  -H 'Content-Type: application/json' \
  -d '{"parts":[{"type":"text","text":"执行 bash 命令: echo hello"}]}'
```

**注意**：prompt 必须能触发目标代码路径。如果调试的是 before-hook，prompt 需要让 agent 调用工具（不能只是文本回复，纯文本回复不触发 before-hook）。

---

## §2.1 根因模式详解（因果链、诊断要点、修复方案）

### 模式 A: 未完成必需 skill/rule attest

- **因果链**：Agent 未按当前 skill/rule 流程完成 `skill_read_attest` / `rule_read_attest` → 直接调用受保护工具 → 被 compliance-gate 或 skill-policy 阻断。
- **诊断要点**：查 `execution_checklist_items`、attest 工具调用记录、`skill-policy`/`compliance` 日志。不要假设存在 `read_skill` 自定义工具，除非当前代码/config 明确提供。
- **修复方案**：通过 system prompt 或 `curl POST /session/{SID}/prompt_async` 要求 agent 使用当前 `skill`/attest 流程；必要时更新 dispatch prompt 或 agent prompt，而不是发明不存在的工具。

### 模式 B: config_read_attest 路径 bug

- **因果链**：`config_read_attest()` 工具内部读取的配置文件路径错误或文件不存在 → attest 永远返回 fail → 门禁无法通过
- **诊断要点**：手动调用 `config_read_attest()` 工具，查看返回的错误信息；检查 `opencode.json` 中声明的路径；用 `test -f` 验证文件实际存在性
- **修复方案**：修正 `opencode.json` 中的路径配置；或修复 `config_read_attest()` 工具内部的路径解析逻辑

### 模式 C: 关键词路由不匹配

- **因果链**：`route_rules.verb_to_agent` 中的关键词列表不完整 → 用户的任务描述不匹配任何关键词 → dispatch 被路由到错误 agent 或被拒（ROUTE-MISMATCH）
- **诊断要点**：查 dispatch-validate 日志，确认匹配的关键词；对比 `route_rules.verb_to_agent` 配置，确认关键词列表是否覆盖任务描述中的动词
- **修复方案**：在 `route_rules.verb_to_agent` 中补充缺失的关键词；或调整任务描述使用已知关键词

### 模式 D: 框架维护写入被自身阻断

- **因果链**：框架 bug 阻止修复框架 → 五层串行阻断，修复操作本身被阻断 → 无法通过任何方式修改框架代码
- **诊断要点**：确认是否应该走 `dispatch_privilege` + `safe_framework_edit`；确认 `build` 是否有 `safe_framework_edit` permission；确认 grant、CodeGraph impact、allowed path 是否同时满足。
- **修复方案**：优先通过 Orchestrator 创建受控 grant 并派遣 `build`；如果是框架无法自举的紧急修复，人工直接编辑文件并重启 serve，但文档中必须标注这是 human break-glass，不是正常 agent 路径。

### 模式 E: Orphan blocks 累积

- **因果链**：before-hook 拦截了工具调用（throw）→ after-hook 不触发（因为工具没执行）→ `compliance_blocks` 异常增长 → 达到阈值后 session 锁定
- **诊断要点**：查 `tool_enforcement.compliance_blocks` 是否异常增长；查日志确认 before-hook 是否 throw 但无对应 after-hook 记录；查 `orphan-detected` 日志关键词
- **修复方案**：修复 after-hook 触发逻辑（即使 before-hook throw 也应触发 after-hook 做清理）；或调整 `compliance_blocks` 阈值；或通过 SQLite 重置计数器

### 模式 F: Throw Preemption

- **因果链**：before-dispatcher 按 `plugin_execution_order.before` 顺序串行执行 handler → 执行链中某个 handler throw → `for...of` 循环终止 → 后续 handler 全部不执行
- **诊断要点**：查看声明的执行顺序 `bun -e "const c = require('$FW_ROOT/.opencode/project.config.json'); c.plugin_execution_order.before.forEach((h, i) => console.log((i+1) + '. ' + h))"`；查看实际执行的 handler `grep -E 'BEFORE-DISPATCHER.*RUN handler=' $LOG_DIR/*.log`；定位 throw 源（找到最后一个成功执行的 handler 和紧随其后的错误信息）
- **修复方案**：修复 throw 的 handler（使其不 throw 或 catch 异常）；或调整执行顺序将关键 handler 移到 throw 源之前；或修改 dispatcher 使其 catch 单个 handler 的 throw 后继续执行后续 handler

---

## §2.2 完整 DB schema 与 SQL 模板

### tool_enforcement 表 schema

```sql
-- 关键字段
session_id          TEXT PRIMARY KEY
agent               TEXT
consecutive_failures INTEGER DEFAULT 0
total_failures      INTEGER DEFAULT 0
compliance_blocks   INTEGER DEFAULT 0
awaiting_guidance   INTEGER DEFAULT 0
guidance_token      TEXT
guidance_requested_at INTEGER DEFAULT 0
stop_injected       INTEGER DEFAULT 0
```

### 状态检查 SQL

```bash
wsl.exe -d Ubuntu-24.04 -- bash -lc "bun -e \"
const {Database} = require('bun:sqlite');
const db = new Database('$DB_PATH');
const rows = db.query('SELECT session_id, agent, consecutive_failures, total_failures, compliance_blocks, awaiting_guidance, guidance_token, guidance_requested_at, stop_injected FROM tool_enforcement ORDER BY rowid DESC LIMIT 10').all();
console.log(JSON.stringify(rows, null, 2));
\""
```

### 重置计数器 SQL（修复模式 D 用）

```sql
UPDATE tool_enforcement
SET consecutive_failures = 0,
    compliance_blocks = 0,
    awaiting_guidance = 0,
    guidance_token = NULL,
    guidance_requested_at = 0,
    stop_injected = 0
WHERE session_id = ?;
```

### read_audit 全量读取验证 SQL

```sql
-- 验证 content_length / file_size >= 0.8
SELECT session_id, file_path,
       content_length, file_size,
       ROUND(CAST(content_length AS FLOAT) / NULLIF(file_size, 0), 2) as ratio
FROM read_audit
WHERE session_id = ?
ORDER BY ratio ASC
LIMIT 20;
```

### 必需读取文件列表

Agent 启动时必须读取的文件（用于 compliance-gate 验证）：
- `opencode.json` — 主配置
- `.opencode/project.config.json` — 项目配置
- `.opencode/rules/*.md` — 规则文件（通过 `instructions` glob 匹配）
- `.opencode/skills/*/SKILL.md` — Skill 定义
- Agent 对应的 `.opencode/agents/<AgentName>.md` — Agent 能力声明

hash 验证方法：对比 `read_audit.content_hash` 与文件实际 hash（`sha256sum <file>`）确认读取的是最新版本。

---

## §3.1 Raw Export 对比矩阵

serve API 的 `GET /message` 不回传 tool_call 事件详情。用 `opencode export` 从 SQLite DB 直接提取完整 transcript：

```bash
wsl.exe -d Ubuntu-24.04 -- bash -lc "opencode export <session_id>"
wsl.exe -d Ubuntu-24.04 -- bash -lc "opencode export <session_id> | grep -A5 'safe_shell\|safe_edit'"
```

| export 结果 | serve API message | 结论 |
|------------|---------------|------|
| 有 tool call 记录 | 无 tool_calls 字段 | serve API 协议限制（已知行为），非框架 bug |
| 无 tool call 记录 | 无 tool_calls 字段 | 工具确实没被调用（问题在 agent 决策层） |
| 有记录 | 框架日志无对应 hook 条目 | hook 确实没触发 → 进入 Step B/C |

---

## §4.1 Scripts→Service 验证脚本

### Step 2: service 函数示例

```typescript
// service/<domain>/<module>.ts
import { getDb } from "../lib/db";  // 注意路径从 scripts/ 调整到 service/
import type { SomeType } from "./types";

export function extractBusinessLogic(param: string): Result {
  // 纯业务逻辑，不含 CLI 相关代码
  // 不使用 process.argv、console.log、process.exit
}

export function queryState(sessionId: string): StateRow | null {
  const db = getDb();
  return db.query("SELECT ...").get(sessionId) as StateRow | null;
}
```

### Step 3: thin shell 示例

```typescript
#!/usr/bin/env bun
// scripts/<target>.ts — thin shell, business logic in service/<domain>/<module>.ts
import { extractBusinessLogic } from "../service/<domain>/<module>";

const args = process.argv.slice(2);
const sessionId = args[0];
if (!sessionId) {
  console.error("Usage: <target>.ts <session-id>");
  process.exit(1);
}
const result = extractBusinessLogic(sessionId);
console.log(JSON.stringify(result, null, 2));
```

### 清除 Bun 缓存 + 重启 serve

```bash
wsl.exe -d Ubuntu-24.04 -- bash -lc "rm -rf ~/.bun/install/cache && echo 'Bun cache cleared'"
wsl.exe -d Ubuntu-24.04 -- bash -lc "pkill -f 'opencode serve' 2>/dev/null; sleep 1"
wsl.exe -d Ubuntu-24.04 -- bash -lc "cd $FW_ROOT && setsid /home/zhaoge/.opencode/bin/opencode serve --port 4096 > /tmp/opencode-serve.log 2>&1 &"
sleep 3
wsl.exe -d Ubuntu-24.04 -- bash -lc "curl -s http://localhost:4096/api/session | head -c 100 && echo '... serve OK'"
```

### 确认 plugin load 日志

```bash
wsl.exe -d Ubuntu-24.04 -- bash -lc "cat $FW_ROOT/.task_temp/_logs/$(date +%Y-%m-%d)/plugin-*-loaded.log 2>/dev/null | tail -20"
wsl.exe -d Ubuntu-24.04 -- bash -lc "grep -i 'error\|fail\|cannot find' $FW_ROOT/.task_temp/_logs/$(date +%Y-%m-%d)/_error.log 2>/dev/null | tail -10"
```

### serve API 端到端测试

```bash
# 1. 创建 session
SID=$(curl -s -X POST http://localhost:4096/session \
  -H 'Content-Type: application/json' \
  -d '{"title":"test","agent":"Orchestrator"}' | \
  python3 -c 'import sys,json; print(json.load(sys.stdin)["id"])')

# 2. 发送简单读取指令
curl -s -X POST http://localhost:4096/session/$SID/prompt_async \
  -H 'Content-Type: application/json' \
  -d '{"parts":[{"type":"text","text":"读取 opencode.json 并报告 MCP server 数量"}]}'

# 3. 等待 15-30s 后检查回复 + SSE 事件
sleep 20
curl -s "http://localhost:4096/session/$SID/message?limit=1"
tail -30 /tmp/sse-events.jsonl | grep $SID

# 4. 清理 session
curl -s -X POST http://localhost:4096/session/$SID/abort
```

---

## §5.1 注册 MCP Server 完整脚本

```javascript
const fs = require('fs');
const configPath = '/home/zhaoge/workspace/opencode/work-one/opencode.json';
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

config.mcp['<server-name>'] = {
  type: 'local',
  command: ['<runtime>', '<script-or-binary-path>'],
  environment: { /* 如需要 */ },
  timeout: 60000,
  enabled: true
};

fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
console.log('MCP server registered. Total servers:', Object.keys(config.mcp).length);
```

**验证：**
```bash
bun -e "const c=JSON.parse(require('fs').readFileSync('$BASE/opencode.json','utf8')); console.log('Valid JSON. MCP servers:', Object.keys(c.mcp).length); console.log('New entry:', JSON.stringify(c.mcp['<server-name>'], null, 2))"
```

---

## §5.2 更新 Agent 权限矩阵完整脚本

```javascript
const fs = require('fs');
const configPath = '/home/zhaoge/workspace/opencode/work-one/opencode.json';
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Current active agent keys in this checkout.
// Do not use legacy role names unless opencode.json currently contains them.
const agents = ['Orchestrator', 'build', 'general', 'explore', 'plan'];
const toolNames = ['<tool1>', '<tool2>'];

let ruleCount = 0;
for (const agent of agents) {
  if (!config.agent[agent]) continue;
  if (!config.agent[agent].permission) config.agent[agent].permission = {};
  for (const tool of toolNames) {
    config.agent[agent].permission[tool] = 'allow';
    ruleCount++;
  }
}

fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
console.log(`Added ${ruleCount} permission rules (${agents.length} agents x ${toolNames.length} tools)`);
```

**验证：**
```bash
bun -e "
const c=JSON.parse(require('fs').readFileSync('$BASE/opencode.json','utf8'));
const agents=['Orchestrator','build','general','explore','plan'];
const tools=['<tool1>','<tool2>'];
let ok=0;
for(const a of agents){for(const t of tools){if(c.agent[a]?.permission?.[t]==='allow')ok++;else console.log('MISSING:',a,t)}}
console.log(ok+'/',agents.length*tools.length,'rules present');
"
```

---

## §5.3 更新 Agent .md 能力声明完整脚本

当前 checkout 只有 `.opencode/agents/Orchestrator.md`。native `build/general/explore/plan` 没有对应 `.md` 文件，能力暴露主要靠 `opencode.json` permission、dispatch prompt、skills 和 tool definitions。

只在 Orchestrator 需要显式知道新工具或新流程时修改 `Orchestrator.md`：

```bash
grep -n '<tool-or-skill-name>' /home/zhaoge/workspace/opencode/work-one/.opencode/agents/Orchestrator.md
```

如果缺失，使用正常编辑流程补充一句操作策略，而不是批量创建不存在的 native agent md。

---

## §6.1 Context Token 基线测量脚本

默认先用 serve API 与本地配置做上下文组成审计；只有需要研究上游 ACP 协议精确 token 时，才运行 ACP 脚本。

当前 active agent 记录格式：

| Agent | inputTokens | 备注 |
|-------|-------------|------|
| Orchestrator | TBD | custom prompt |
| build | TBD | native agent |
| general | TBD | native agent |
| explore | TBD | native agent |
| plan | TBD | native agent |

---

## §6.2 Context Token 累计操作记录表

每轮优化后重新运行同一种测量脚本，输出对比表：

| Agent | 基线 | 优化后 | 节省 | 降幅 |
|-------|------|--------|------|------|
| Orchestrator | TBD | TBD | TBD | TBD |

**累计操作记录表**：

| 操作 | 节省 tokens | 累计降幅 |
|------|------------|---------|
| 移除 index.json | ~10K | -9% |
| 移除废弃 rule 文件 | ~2.6K | -11% |
| 压缩 skill-invocation-standard | ~3.5K | -15% |
| 压缩 4 个大 rule 文件 | ~11K | -43.7% |
| Skills 目录化 | ~10K | -52% |

---

## §7.1 Session Map Cross-DB 覆盖率计算完整脚本

```bash
cat > /tmp/session-audit.ts << 'AUDIT_EOF'
const { Database } = require("bun:sqlite");

const sdkPath = process.env.OPENCODE_DB || `${process.env.HOME}/.local/share/opencode/opencode.db`;
const fwPath = "<PROJECT_DIR>/.opencode/state/framework-state.db";

const sdk = new Database(sdkPath, { readonly: true });
const fw = new Database(fwPath, { readonly: true });

const sdkCount = sdk.query("SELECT COUNT(*) as cnt FROM session").get().cnt;
const fwCount = fw.query("SELECT COUNT(*) as cnt FROM session_map").get().cnt;
const matched = fw.query(`
  SELECT COUNT(*) as cnt FROM session_map sm
  WHERE EXISTS (SELECT 1 FROM session s WHERE s.id = sm.session_id)
`).get().cnt;

console.log(`SDK sessions: ${sdkCount}`);
console.log(`session_map entries: ${fwCount}`);
console.log(`Matched: ${matched}`);
console.log(`Coverage: ${(matched / sdkCount * 100).toFixed(1)}%`);
console.log(`Unmatched SDK sessions: ${sdkCount - matched}`);
AUDIT_EOF
```

**判断标准**:
- 覆盖率 > 85%: 健康
- 覆盖率 50-85%: 需关注，可能有 orphan cleanup 过于激进
- 覆盖率 < 50%: 严重退化，通常意味着 death loop 或迁移未执行

### 时间维度分析

```typescript
const dailyStats = fw.query(`
  SELECT
    DATE(created_at / 1000, 'unixepoch') as day,
    COUNT(*) as total,
    SUM(CASE WHEN EXISTS (SELECT 1 FROM session s WHERE s.id = session_map.session_id) THEN 1 ELSE 0 END) as matched
  FROM session_map
  GROUP BY day
  ORDER BY day DESC
  LIMIT 30
`).all();

for (const row of dailyStats) {
  const rate = row.total > 0 ? (row.matched / row.total * 100).toFixed(1) : "N/A";
  console.log(`${row.day}: ${row.matched}/${row.total} (${rate}%)`);
}
```

### Orphan 检测

```typescript
const orphans = sdk.query(`
  SELECT s.id, s.parent_id, s.agent, s.title, s.created_at
  FROM session s
  WHERE NOT EXISTS (SELECT 1 FROM session_map sm WHERE sm.session_id = s.id)
  ORDER BY s.created_at DESC
  LIMIT 50
`).all();

console.log(`\n=== Orphan Sessions (SDK有, session_map无) ===`);
for (const o of orphans) {
  const parent = o.parent_id ? `parent=${o.parent_id.substring(0, 12)}...` : "ROOT";
  console.log(`  ${o.id.substring(0, 16)}... | ${o.agent || "null"} | ${parent} | ${new Date(o.created_at).toISOString()}`);
}

const rootOrphans = orphans.filter(o => !o.parent_id).length;
const subOrphans = orphans.filter(o => o.parent_id).length;
console.log(`\nRoot orphans: ${rootOrphans}, Sub-agent orphans: ${subOrphans}`);
```

### Agent Normalization 检查

```typescript
const agentStats = fw.query(`
  SELECT agent, COUNT(*) as cnt
  FROM session_map
  GROUP BY agent
  ORDER BY cnt DESC
`).all();

console.log(`\n=== Agent Distribution ===`);
for (const a of agentStats) {
  const isPascal = /^[A-Z][a-zA-Z0-9_-]*$/.test(a.agent);
  const isLower = /^[a-z][a-z0-9_-]*$/.test(a.agent);
  const tag = isPascal ? "PascalCase" : isLower ? "SDK-builtin" : "ABNORMAL";
  console.log(`  ${a.agent}: ${a.cnt} ${tag}`);
}

const atPrefix = fw.query(`
  SELECT COUNT(*) as cnt FROM session_map WHERE agent LIKE '@%'
`).get().cnt;
if (atPrefix > 0) {
  console.log(`\nFound ${atPrefix} entries with '@' prefix in agent field!`);
}
```

---

## §7.2 Parent-ID 链路验证完整脚本

```typescript
const fwParentStats = fw.query(`
  SELECT
    COUNT(*) as total,
    SUM(CASE WHEN parent_id IS NOT NULL AND parent_id != '' THEN 1 ELSE 0 END) as filled
  FROM session_map
`).get();
console.log(`\nsession_map parent_id: ${fwParentStats.filled}/${fwParentStats.total} filled`);

const sdkParentStats = sdk.query(`
  SELECT
    COUNT(*) as total,
    SUM(CASE WHEN parent_id IS NOT NULL AND parent_id != '' THEN 1 ELSE 0 END) as filled
  FROM session
`).get();
console.log(`SDK parent_id: ${sdkParentStats.filled}/${sdkParentStats.total} filled`);

const chains = sdk.query(`
  SELECT s.id, s.parent_id, s.agent,
         p.agent as parent_agent,
         gp.id as grandparent_id, gp.agent as grandparent_agent
  FROM session s
  LEFT JOIN session p ON s.parent_id = p.id
  LEFT JOIN session gp ON p.parent_id = gp.id
  WHERE s.parent_id IS NOT NULL AND p.parent_id IS NOT NULL
  LIMIT 10
`).all();

console.log(`\n=== Three-Level Chain Samples ===`);
for (const c of chains) {
  console.log(`  ${c.grandparent_agent} -> ${c.parent_agent} -> ${c.agent}`);
}
```

### 完整审计脚本模板

```typescript
const { Database } = require("bun:sqlite");

const PROJECT = "<PROJECT_DIR>";
const sdkPath = `${process.env.HOME}/.local/share/opencode/opencode.db`;
const fwPath = `${PROJECT}/.opencode/state/framework-state.db`;

const sdk = new Database(sdkPath, { readonly: true });
const fw = new Database(fwPath, { readonly: true });

console.log("=== Session Map Audit ===\n");

const sdkCount = sdk.query("SELECT COUNT(*) as c FROM session").get().c;
const fwCount = fw.query("SELECT COUNT(*) as c FROM session_map").get().c;
const matched = fw.query(
  "SELECT COUNT(*) as c FROM session_map sm WHERE EXISTS(SELECT 1 FROM session s WHERE s.id=sm.session_id)"
).get().c;
console.log(`Coverage: ${matched}/${sdkCount} (${(matched/sdkCount*100).toFixed(1)}%)`);
console.log(`session_map entries: ${fwCount}\n`);

const agents = fw.query("SELECT agent, COUNT(*) as c FROM session_map GROUP BY agent ORDER BY c DESC").all();
console.log("Agent distribution:");
for (const a of agents) console.log(`  ${a.agent}: ${a.c}`);

const fwParent = fw.query("SELECT COUNT(*) as t, SUM(CASE WHEN parent_id IS NOT NULL AND parent_id!='' THEN 1 ELSE 0 END) as f FROM session_map").get();
console.log(`\nParent-ID fill: ${fwParent.f}/${fwParent.t} (${(fwParent.f/fwParent.t*100).toFixed(1)}%)`);

const orphans = sdk.query(
  "SELECT COUNT(*) as c FROM session s WHERE NOT EXISTS(SELECT 1 FROM session_map sm WHERE sm.session_id=s.id)"
).get().c;
console.log(`Orphans (SDK有session_map无): ${orphans}`);

console.log("\n=== Audit Complete ===");
```

### 回填脚本模板

```typescript
#!/usr/bin/env bun
import { Database } from "bun:sqlite";

const SDK_DB = process.env.OPENCODE_DB || `${process.env.HOME}/.local/share/opencode/opencode.db`;
const FW_DB = `${process.cwd()}/.opencode/state/framework-state.db`;
const DRY_RUN = process.argv.includes("--dry-run");

const sdk = new Database(SDK_DB, { readonly: true });
const fw = new Database(FW_DB);

const missing = sdk.query(`
  SELECT s.id, s.agent, s.parent_id, s.created_at
  FROM session s
  WHERE NOT EXISTS (SELECT 1 FROM session_map sm WHERE sm.session_id = s.id)
  AND s.agent IS NOT NULL
`).all();

console.log(`Missing: ${missing.length} sessions`);

if (!DRY_RUN) {
  const insert = fw.prepare(`
    INSERT OR IGNORE INTO session_map (session_id, agent, created_at, updated_at, parent_id)
    VALUES (?, ?, ?, ?, ?)
  `);
  for (const s of missing) {
    insert.run(s.id, s.agent, s.created_at, Date.now(), s.parent_id);
  }
  console.log(`Backfilled ${missing.length} sessions`);
}
```

---

## §7.3 Session Map 关键代码文件位置

| 文件 | 关键函数 | 职责 |
|------|---------|------|
| `service/session/session-map.ts` | `upsertSessionMap()`, `cleanOrphanSessionMaps()`, `normalizeAgent()` | session_map CRUD + orphan 清理 + agent 名标准化 |
| `service/session/lifecycle.ts` | `writeSessionMapWithConstraint()`, `runStartupCleanup()` | 约束写入（检查 trusted source）+ 启动清理 |
| `plugins/session.ts` | `session.created` hook | session 创建时立即写入 session_map |
| `lib/db-manager.ts` | schema migrations | DDL 变更（ALTER TABLE 等） |
| `lib/db-state-manager.ts` | `dbWriteSessionMap()`, `dbReadSessionMap()` | 底层 SQL 执行 |

---

## §7.4 Session Map 修复方案设计（P0-P3 优先级）

### P0 - 止血（death loop）

修改 `cleanOrphanSessionMaps()`：
- 加 24h 时间窗口：`WHERE updated_at < (now - 24*60*60*1000)`
- 加 `dispatch:%` 排除：`AND session_id NOT LIKE 'dispatch:%'`
- 效果：立即停止覆盖率退化

### P1 - Schema 补全

- 迁移：`ALTER TABLE session_map ADD COLUMN parent_id TEXT DEFAULT NULL` + 索引
- `dbWriteSessionMap` 4 个 SQL path 全部加 `parent_id` 列
- `upsertSessionMap` 增加 `parentId` 参数透传
- `plugins/session.ts` 新增 `session.created` hook
- `writeSessionMapWithConstraint` 从 SDK session 表读取 `parent_id` 并传递

### P2 - 数据一致性

- `normalizeAgent()` 改为去 `@` 前缀保留 PascalCase（`@Orchestrator` → `Orchestrator`）
- 消除同一 agent 多种写法并存的问题

### P3 - 历史回填

- 一次性脚本：从 SDK session 表回填 session_map（见 §7.2 回填脚本模板）
- 清理 orphan 条目
- 回填后重新运行 Step 1-6 验证

---

## §8.1 SQLite Per-Table Size Estimation 完整脚本

```javascript
const tables = db.query(
  "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
).all();

for (const t of tables) {
  const cols = db.query(`PRAGMA table_info("${t.name}")`).all();
  const textCols = cols.filter(c =>
    ['TEXT','BLOB','VARCHAR','CLOB','JSON'].some(typ =>
      (c.type || '').toUpperCase().includes(typ)
    )
  );

  if (textCols.length === 0) continue;

  const sumExpr = textCols
    .map(c => `COALESCE(LENGTH("${c.name}"), 0)`)
    .join(' + ');

  const row = db.query(
    `SELECT COUNT(*) as cnt, SUM(${sumExpr}) as data_bytes FROM "${t.name}"`
  ).get();

  console.log(`${t.name}: ${row.cnt} rows, ${(row.data_bytes / 1024 / 1024).toFixed(2)} MB`);
}
```

Sort output by `data_bytes` descending. The top offender is your primary suspect.

**Quick sanity check**: Sum of all table data_bytes should be within 50-80% of total DB size. If much less, the rest is index overhead or fragmentation.

### Deep-Dive the Hot Table 完整 SQL

```sql
SELECT COUNT(*) as total_rows,
       MIN(created_at) as earliest,
       MAX(created_at) as latest
FROM hot_table;

SELECT
  COUNT(*) as total,
  COUNT(some_col) as non_null,
  COUNT(DISTINCT some_col) as distinct_vals,
  AVG(LENGTH(some_col)) as avg_len,
  MAX(LENGTH(some_col)) as max_len
FROM hot_table;

SELECT * FROM hot_table ORDER BY id DESC LIMIT 5;

SELECT
  COUNT(*) as total,
  SUM(CASE WHEN cleanup_col IS NOT NULL THEN 1 ELSE 0 END) as cleaned,
  SUM(CASE WHEN cleanup_col IS NULL THEN 1 ELSE 0 END) as not_cleaned
FROM hot_table;
```

### Stale Cleanup 检查 SQL

```sql
SELECT status, COUNT(*) as cnt,
  SUM(CASE WHEN cleanup_marker IS NULL THEN 1 ELSE 0 END) as never_cleaned
FROM hot_table
GROUP BY status;
```

If all rows have `cleanup_marker = NULL` despite a compactor existing in code, the cleanup was designed but never activated. Check:
1. Is the compactor triggered by a timer, event, or manual call?
2. Is the trigger condition ever met? (threshold too high? flag never set?)
3. Was the migration applied but the runtime logic never wired up?

---

## §9.1 Blueprint Audit 差异报告模板

```markdown
# Blueprint Audit Report — YYYY-MM-DD

## 审核范围
- 文件: target-structure.md, context-lazy-loading-plan.md, ...
- 代码库: /home/zhaoge/workspace/opencode/work-one/.opencode/

## 差异汇总

| # | 文档 | 位置 | 声明值 | 实际值 | 类型 |
|---|------|------|--------|--------|------|
| 1 | target-structure.md | L15 "26 文件" | 26 | 31 | 过时（新增5文件未记录）|
| 2 | target-structure.md | L42 "105 文件" | 105 | 112 | 过时 |
| 3 | context-lazy-loading-plan.md | L28 "149L" | 149 | 162 | 过时（后续修改增加了行数）|
| 4 | target-structure.md | L78 "dispatch-auto.ts" | 存在 | 不存在 | 已删除 |

## 一致项（抽样）
- ✅ plugins/ 目录下 anti-bypass.ts 存在且函数签名匹配
- ✅ opencode.json plugin 列表与文档记录一致（27 项）

## 待人工确认
- target-structure.md L95: "service/gate/ 目录含 20 文件" — 此处是否包含 index.ts？
  - 含 index.ts: 实际 21 文件
  - 不含 index.ts: 实际 20 文件 ✅

## 修正记录
（Step 5 完成后填写）
```

差异类型分类：
- **过时**: 代码已变更，文档未同步
- **错误**: 文档记录与实际不符（可能是笔误）
- **已删除**: 文档提到的文件/功能已不存在
- **新增未记录**: 代码中有新文件/功能，文档未提及
