---
name: debug-environment-toolkit
version: 3.0.0
agent_created: true
description: "Debugging toolkit covering 4 areas: log-first debugging, VM error recovery, WSL bash-c escaping patterns, and beginner investigation coaching. Trigger: debug, troubleshoot, root cause, 调试, 根因分析, log-first debugging, startup failure, secure workspace error, WSL bash -c, 排查, 定位问题, 复现, 临时日志, 小白. Not for: feature implementation, code review, or non-debugging tasks."
---

# Debug & Environment Toolkit

## Language / 语言

Follow the user's language: reply in Chinese for Chinese requests and English for English requests. Provide both only when requested; preserve code, commands, paths, API names, identifiers, and quoted source text exactly.

Four complementary methodologies: (1) locate bugs via runtime logs, (2) recover secure workspace startup errors, (3) avoid WSL escaping hell when running scripts, (4) coach beginners through systematic investigation.

## 1. Log-First 调试法

### Core Principle

**Run code + read logs = find bug. Reading source code to guess the bug wastes time and money.**

Source code tells you what the developer *intended*; logs tell you what the program *actually did*. Always prefer the latter.

### Anti-Patterns (Forbidden)

- Reading 200+ lines of source code trying to "understand the flow" before writing a single log
- Building mental models of execution paths without runtime evidence
- Debating "I think the bug is here because the code looks like..." without log proof
- Spending >2 minutes reading source without inserting any investigation log
- Chasing call chains across 5+ files purely by reading

These behaviors burn tokens (money) and clock time while producing unreliable conclusions.

### The 4-Step Loop

> **步骤类型标注**：Step 1-2 是 `[ANALYSIS]`（形成假设+插入日志），Step 3 是 `[VERIFICATION]`（运行代码+捕获日志），Step 4 是 `[OBSERVATION]`（基于日志定位根因）。
> **关键约束**：Step 3 不可跳过。「我已经从代码理解了问题」不是跳过 Step 3 的理由--代码告诉你的是意图，运行告诉你的是事实。
> **合理化检测**：如果你发现自己在想「代码已经清楚表明了问题根因，不需要运行」--停下来，这是 ANALYSIS vs VERIFICATION 混淆。

#### Step 1: Form a Minimal Hypothesis (< 2 minutes)

Based on the error message or symptom, spend at most 2 minutes forming a rough hypothesis. Acceptable inputs:

- Error message text and stack trace
- Which component/module the symptom points to
- Recent changes (git log, file timestamps)

Output: one sentence — "I suspect X is failing because Y."

If you can't form even a rough hypothesis in 2 minutes, skip to Step 2 with a generic log placement strategy.

#### Step 2: Insert Targeted Investigation Logs

Add temporary logs at the suspected failure points. Rules:

- **Log at boundaries**: function entry/exit, before/after critical operations, error catch blocks
- **Log state, not just flow**: print variable values, not just "entered function X"
- **Use distinctive markers**: prefix with `[DEBUG-TMP]` or `[INVESTIGATE]` so they're easy to find and remove later
- **Minimal intrusion**: don't restructure code just for logging; add prints alongside existing logic
- **Timestamp or sequence numbers**: help establish execution order

Example (TypeScript/Bun):
```typescript
process.stderr.write(`[DEBUG-TMP] handler called, id=${id}, state=${JSON.stringify(state)}\n`);
```

Example (Python):
```python
import sys
print(f"[DEBUG-TMP] process_item: item={item!r}, len(queue)={len(queue)}", file=sys.stderr)
```

#### Step 3: Run and Observe `[VERIFICATION]`

> **注意**：源码分析回答「代码意图是什么」，运行态验证回答「运行态实际是什么」。两者可能不一致——Step 1-2 的假设必须通过本步骤的实际运行来证实或证伪。

Execute the code to reproduce the issue. Capture the log output. This is non-negotiable — you must actually run the code.

> **本步骤是 `[VERIFICATION]`**——必须实际运行代码并捕获日志输出。
> 执行后记录 `Verified-by: 运行命令 + 日志输出摘要`。
> 如果跳过本步骤，Step 4 的根因结论将缺乏运行态证据支撑。

- If the bug reproduces: examine log output to confirm or refute the hypothesis
- If the bug doesn't reproduce: check whether your logs are actually being hit; adjust log placement and retry
- If logs are insufficient: add more targeted logs based on what you *did* see, then re-run

#### Step 4: Locate and Conclude

With log evidence in hand, identify the exact failure point. The logs will show you:

- Which branch was actually taken
- What values variables actually held
- Where execution stopped or diverged from expectations

Once located, state the root cause with log evidence as proof. Then clean up all temporary logs.

### Decision Rules

| Situation | Action |
|-----------|--------|
| Error has stack trace | Start logging at the top frame you control; run to capture state |
| "It just doesn't work" | Log at the entry point and exit point of the main flow; run |
| Intermittent bug | Add logs + a counter/timestamp; run multiple times |
| Performance issue | Add timing logs around suspected slow sections; run with profiler if needed |
| Source code is confusing | Ignore it — add logs to see what actually happens at runtime |

### Source Code Reading Rules

Source code reading is **supplementary only**. Permitted uses:

- Finding *where* to insert logs (function names, file paths)
- Understanding API signatures (what parameters a function accepts)
- Confirming a fix after logs already identified the root cause

Forbidden uses:

- Trying to understand "the full flow" before debugging
- Reading code to predict what "should" happen instead of observing what does
- Following import chains or call graphs purely by reading

**Time budget**: If you've been reading source code for more than 2 minutes without inserting or examining logs, stop immediately and switch to Step 2.

### Cleanup

After the bug is located and fixed:

1. Remove all `[DEBUG-TMP]` / `[INVESTIGATE]` logs
2. If the fix needs permanent logging, add proper structured logs (not debug prints)
3. Verify the fix still passes by re-running with the clean code

### Workflow Summary

```
Symptom reported
    ↓
2-min hypothesis (max)
    ↓
Insert [DEBUG-TMP] logs at suspected points
    ↓
Run code → capture log output
    ↓
Read logs → locate exact failure
    ↓
Fix → clean up temp logs → verify
```

If at any point you catch yourself reading source code for more than 2 minutes without running anything, stop and go back to "insert logs and run."

---

## 2. VM 错误恢复

Guide users through diagnosing and fixing secure workspace startup errors. Never expose internal implementation details — focus on actionable steps in plain language.

### Diagnostic Procedure

#### Step 1: Read the Diagnostic File

Use the `Read` tool to read the diagnostic state file:

```
~/{{.DataDirName}}/vm/boot-state.json
```

This file contains:

```json
{
  "boot_id": "boot_...",
  "status": "booting | ready | failed | stopped",
  "error": {
    "phase": "...",
    "code": "...",
    "message": "...",
    "errorKey": "the_key_to_match_below"
  },
  "environment": {
    "platform": "darwin | windows",
    "arch": "x64 | arm64",
    "os_version": "...",
    "qoderwork_version": "..."
  },
  "phases": { ... }
}
```

#### Step 2: Identify the Error

Extract `error.errorKey` from the JSON. If the file does not exist or cannot be read, skip to the **Fallback** section below.

#### Step 3: Look Up Recovery Instructions

Match the `errorKey` against the error reference tables. Use `environment.platform` to determine whether to give Windows-specific or macOS-specific instructions.

**The full error recovery reference (Category A: Simple Retry, Category B: Specific Actions, Category C: Cannot Be Fixed) is in [reference.md](reference.md).** Key error keys by category:

- **Category A (Simple Retry)**: `hcs_timeout`, `hcs_insufficient_resources`, `guest_init_failed`, `manifest_network_error`, `download_checksum_mismatch`, `hcs_access_denied` — transient errors, guide retry
- **Category B (Specific Actions)**: `image_not_found`, `download_disk_full`, `download_extract_failed`, `win_hyperv_not_enabled`, `hcs_service_not_installed` — require settings changes, disk cleanup, or feature enablement
- **Category C (Cannot Be Fixed by User)**: `vf_create_failed` (macOS too old), unrecognized errors — require system upgrade or support

#### Step 4: Guide the User

- Use **plain, non-technical language** — never mention internal component names
- Use the user's language (Chinese / English) matching their conversation
- When the recovery involves opening a settings page, use the Connector to help

### Fallback: No Diagnostic File

**Condition:** `~/{{.DataDirName}}/vm/boot-state.json` does not exist or cannot be read.

> I couldn't find diagnostic information about the error. Let's try some general steps:
>
> 1. Restart QoderWork and try again
> 2. If the problem persists, restart your computer
> 3. If it still doesn't work, open **Settings** > **Secure Workspace** tab > click **"Clean Workspace"**, wait for re-download, and try again
> 4. If none of the above helps, click the feedback button (top-right corner) to report the issue

### Connector Actions

Use the QoderWork built-in Connector to help users navigate to relevant UI pages.

**Open VM Settings Page** (for "Clean Workspace" button or VM status):

```
mcp__qw-builtin__qw_action({ key: "qoderwork.settings.vm", action: "open" })
```

**Open Feedback Dialog** (pre-fill with diagnostic context):

```
mcp__qw-builtin__qw_action({
  key: "qoderwork.feedback",
  action: "open",
  params: {
    content: "Secure workspace startup error: [brief description of the error]. Error key: [errorKey from boot-state.json]"
  }
})
```

**Check VM Status**:

```
mcp__qw-builtin__qw_query({ key: "qoderwork.settings.vm" })
```

### Important Rules

1. **Never expose internal details.** Do not mention component names like hvkit, VSOCK, HCS, Virtualization.framework, boot-diagnostics, or any internal process names. The user only needs to know about "the secure workspace" or "QoderWork".

2. **Platform awareness.** Check `environment.platform` in boot-state.json:
   - `"darwin"` → macOS instructions (no administrator / PowerShell references)
   - `"windows"` → Windows instructions (administrator, Control Panel, PowerShell)

3. **Match the user's language.** Respond in the same language the user is using (Chinese or English).

4. **Avoid unnecessary alarm.** Frame errors as common, fixable issues. Use reassuring language like "This is usually easy to fix" rather than "critical failure".

5. **Always offer an escalation path.** If the suggested steps don't resolve the issue, always end with: "Click the feedback button in the top-right corner to report this issue for technical support."

6. **Pre-fill feedback when escalating.** When directing users to submit feedback, use the Connector to open the feedback dialog with pre-filled context (error key, platform, brief description) so the support team has the information they need.

---

## 3. WSL Bun 脚本模式

Standard pattern to avoid WSL `bash -c` variable expansion, quote nesting, and path escaping issues. Write complex logic into `.ts`/`.sh` scripts, cp to WSL `/tmp`, then execute via `bun run` or `bash`.

### 何时使用

在 Windows 侧通过 `wsl -d Ubuntu-24.04 bash -c "..."` 执行命令时，以下情况应切换为脚本模式：

- 命令包含 `$()`、`$var`、`${var}` 等 shell 变量展开
- 嵌套引号超过 2 层（如 `bash -c "echo \"$(ls \"$dir\")\""`）
- 包含 `for/do/done`、`if/then/fi`、`while` 等控制结构
- 路径中含中文或空格
- 逻辑超过 5 行 shell 命令
- 需要多次引用同一变量或路径
- 脚本需要读取的文件在 WSL 侧（需 cp-to-tmp）或 Windows 侧（需映射 /mnt/c 路径）
- `bash -c` 因 Windows PATH 含括号导致语法错误（需 pipe-to-stdin）
- 脚本含中文注释且将通过 PowerShell pipe 传入 WSL（CRLF 导致注释吞代码）

### 标准流程

#### Step 1: 编写脚本文件

在本地 workspace 目录写脚本。优先使用 `.ts`（bun 执行，类型安全），简单场景可用 `.sh`。

```typescript
// workspace: my-script.ts
#!/usr/bin/env bun
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const BASE = "/home/zhaoge/workspace/opencode/work-one";
// ... 业务逻辑
console.log("done");
```

#### Step 2: 复制到 WSL /tmp

```bash
wsl -d Ubuntu-24.04 bash -c "cp /mnt/c/Users/USER/.qoderworkcn/workspace/{workspaceId}/my-script.ts /tmp/my-script.ts"
```

路径映射规则：Windows 的 `C:\Users\USER\.qoderworkcn\workspace\{id}\` 对应 WSL 的 `/mnt/c/Users/USER/.qoderworkcn/workspace/{id}/`。

#### Step 2b（变体）: cp-to-tmp — 脚本需读取的源文件也在 WSL /tmp

当 TS 脚本需要 `readFileSync` 读取的文件位于 **Windows 侧 workspace** 时，这些源文件也需要先 cp 到 WSL `/tmp`，脚本内统一用 `/tmp/` 绝对路径访问。

```typescript
// workspace: process-config.ts
#!/usr/bin/env bun
import { readFileSync } from "fs";

// 源文件已从 Windows 侧 cp 到 /tmp，脚本直接用 /tmp 路径读取
const config = JSON.parse(readFileSync("/tmp/opencode.json", "utf-8"));
const data = readFileSync("/tmp/input.md", "utf-8");
console.log(`config keys: ${Object.keys(config).length}, input lines: ${data.split("\n").length}`);
```

复制命令（脚本 + 源文件一起 cp）：

```bash
wsl -d Ubuntu-24.04 bash -c "cp /mnt/c/Users/USER/.qoderworkcn/workspace/{id}/process-config.ts /tmp/process-config.ts && cp /mnt/c/Users/USER/.qoderworkcn/workspace/{id}/opencode.json /tmp/opencode.json && cp /mnt/c/Users/USER/.qoderworkcn/workspace/{id}/input.md /tmp/input.md"
```

**要点**：脚本和它需要读取的所有源文件，都应在同一个 `cp` 链中完成复制。脚本内一律用 `/tmp/filename` 绝对路径，不要依赖 cwd 或相对路径。

如果源文件本身就在 WSL 文件系统内（如 `/home/zhaoge/workspace/...`），则无需额外 cp，脚本直接读取即可。

#### Step 3: 执行脚本

**bun 脚本（.ts）** — 必须显式设置 PATH，因为 WSL 不继承 Windows 环境变量：

```bash
wsl -d Ubuntu-24.04 bash -c "export PATH='/home/zhaoge/.bun/bin:/usr/local/bin:/usr/bin:/bin' && bun run /tmp/my-script.ts"
```

**shell 脚本（.sh）**：

```bash
wsl -d Ubuntu-24.04 bash -c "bash /tmp/my-script.sh"
```

如果脚本需要访问特定工作目录，在执行命令中加 `cd`：

```bash
wsl -d Ubuntu-24.04 bash -c "export PATH='/home/zhaoge/.bun/bin:/usr/local/bin:/usr/bin:/bin' && cd /home/zhaoge/workspace/opencode/work-one && bun run /tmp/my-script.ts"
```

#### Step 3 替代方案: Pipe-to-stdin — 绕过 bash -c 的 PATH/引号问题

当 Windows PATH 含括号（如 `C:\Program Files\...`）泄漏到 `bash -c` 导致语法错误时，改用 pipe 将脚本内容直接送入 WSL stdin，完全绕开 `bash -c "..."` 的引号和 PATH 问题。

**方式 A：PowerShell Get-Content pipe（推荐）**

```bash
powershell -Command "Get-Content 'C:\Users\USER\.qoderworkcn\workspace\{id}\my-script.sh' -Raw | wsl -d Ubuntu-24.04 bash"
```

脚本内部自行设置 PATH 和 HOME：

```bash
#!/bin/bash
export HOME=/home/zhaoge
export PATH=/home/zhaoge/.bun/bin:/usr/local/bin:/usr/bin:/bin

echo "=== running in WSL ==="
bun run /tmp/my-script.ts
```

**方式 B：cmd type pipe**

```bash
type "C:\Users\USER\.qoderworkcn\workspace\{id}\my-script.sh" | wsl -d Ubuntu-24.04 bash
```

**适用场景**：

- `bash -c` 报 `syntax error near unexpected token '('` — Windows PATH 括号泄漏
- 脚本内容含大量引号，`bash -c` 转义过于复杂
- 需要快速测试脚本，不想走 cp + bash 两步

**注意事项**：

- pipe 模式下脚本内容从 stdin 读入，`/tmp` 中不需要有脚本文件（但仍需 cp 依赖的 .ts 源文件）
- 如果脚本内需要 bun，必须在脚本内部 `export PATH`（因为 pipe 模式没有外层 `bash -c` 来设置环境变量）
- pipe 模式适合 .sh 脚本；.ts 脚本仍需先 cp 到 /tmp 再在 .sh 中 `bun run /tmp/xxx.ts`

#### Step 4: 清理（可选）

长时间运行的会话中 /tmp 会积累脚本，可在执行后清理：

```bash
wsl -d Ubuntu-24.04 bash -c "rm -f /tmp/my-script.ts /tmp/opencode.json /tmp/input.md"
```

### 关键细节

- **PATH 必须显式设置**：WSL 非登录 shell 不继承 Windows 的 PATH，bun 路径 `/home/zhaoge/.bun/bin` 不会自动可用
- **bun 路径**：`/home/zhaoge/.bun/bin`
- **HOME 环境变量**：如需 HOME，显式设置 `export HOME='/home/zhaoge'`
- **/tmp 是 WSL 的 /tmp**：不是 Windows 的 `%TEMP%`，两者完全隔离
- **脚本中用绝对路径**：WSL 内的文件操作一律用 `/home/zhaoge/...` 绝对路径，不要依赖 cwd
- **Windows 写文件编码**：Write 工具写出的文件是 UTF-8，bun 可正常处理；但如果 shell 脚本含中文，建议用 `cp` 而非 heredoc
- **源文件可达性**：TS 脚本 `readFileSync` 读取的文件必须在 WSL 文件系统中可达。Windows 侧 workspace 文件通过 `/mnt/c/Users/USER/.qoderworkcn/workspace/{id}/` 可读，但更稳定的做法是先 cp 到 `/tmp`（避免 /mnt/c 挂载偶尔不生效的问题）
- **pipe-to-stdin 优势**：当 `bash -c "..."` 因 Windows 环境变量泄漏（特别是 PATH 中的括号）导致语法错误时，pipe 模式完全绕过 `bash -c`，脚本从 stdin 读入，无需任何引号转义
- **CRLF 陷阱（pipe-to-stdin 模式）**：Windows Write 工具创建的文件使用 CRLF（`\r\n`）行尾。当 `.sh` 或 `.ts` 脚本含中文注释并通过 PowerShell `Get-Content -Raw | wsl bash` 管道传入 WSL 时，`\r` 会导致注释行与后续代码行合并（例如 `// 过滤新事件\r\nconst x = ...` 变成单行 `// 过滤新事件  const x = ...`，代码被注释吞掉）。**规避方法**：(1) pipe 模式的脚本中只用 ASCII 字符（注释和日志消息都用英文），或 (2) 在 WSL 内部直接写脚本（`wsl -d Ubuntu-24.04 bash -c "cat > /tmp/script.ts << 'WSLEOF' ... WSLEOF"`），避免 Windows 行尾污染

### 反模式（不要这样做）

**不要尝试多层转义**：

```bash
# 错误：转义地狱，几乎必定失败
wsl -d Ubuntu-24.04 bash -c "for f in \$(ls /tmp); do echo \\\$f; done"
```

**不要用 heredoc 通过 bash -c 传递多行脚本**：

```bash
# 错误：heredoc 在 bash -c 中行为不可预测
wsl -d Ubuntu-24.04 bash -c "cat << 'EOF' > /tmp/test.sh
#!/bin/bash
echo \$HOME
EOF"
```

**不要假设环境变量继承**：

```bash
# 错误：bun 找不到
wsl -d Ubuntu-24.04 bash -c "bun run /tmp/script.ts"
```

**不要假设 Windows PATH 不泄漏到 bash -c**：

```bash
# 错误：Windows PATH 含括号（如 C:\Program Files\...），泄漏后 bash 报 syntax error
wsl -d Ubuntu-24.04 bash -c "some-command"
# 报错：/mnt/c/Program: No such file or directory（PATH 中的空格和括号导致）
```

遇到这种情况应切换到 pipe-to-stdin 模式（见 Step 3 替代方案）。

**不要在脚本中用相对路径读取源文件**：

```typescript
// 错误：cwd 不确定，相对路径可能找不到
const data = readFileSync("./config.json", "utf-8");

// 正确：用绝对路径
const data = readFileSync("/tmp/config.json", "utf-8");
```

**不要在 pipe-to-stdin 脚本中使用中文注释**：

```bash
# 错误：Write 工具生成 CRLF，PowerShell pipe 到 WSL 后 \r 导致注释吞掉下一行代码
#!/bin/bash
export PATH=/home/zhaoge/.bun/bin:/usr/local/bin:/usr/bin:/bin
# 过滤新事件
const newEvents = lines.filter(...)  # ← 这行会被上面的中文注释吞掉！
```

正确做法：pipe 模式脚本只用 ASCII 注释，或将脚本写入 WSL /tmp 后再执行。

### 实例

完整实例（批量文件迁移、验证脚本、长时间任务、cp-to-tmp 读取源文件、pipe-to-stdin 绕过 PATH 括号问题）见 [reference.md](reference.md)。


---

## 4. Beginner Investigation Coach

Act as a patient investigation coach. The user may not know whether the problem is about code, config, runtime, data, session, permissions, network, UI, or environment. Start from the symptom and guide one small step at a time. The primary goal is to teach the investigation method while solving the current problem.

### Non-Negotiable Rules

- Do not declare a root cause without evidence.
- Do not require the user to know which subsystem is involved.
- Each turn should advance one small investigation action unless the user asks for a full plan.
- Explain every technical term the first time it appears.
- Separate `Known facts`, `Current hypothesis`, `Next observation`, and `What the result would mean`.
- Prefer runtime evidence: reproduction, logs, breakpoints, traces, output, state snapshots, or minimal test cases.
- Temporary investigation logs must be clearly marked (e.g. `[INVESTIGATE]`) and removed after investigation.

### The Six-Stage Flow

Use this flow. Move forward only when the current stage has enough evidence. If evidence is insufficient, loop back to Stage 2 or 3.

#### Stage 1: Beginner Triage

Turn a vague symptom into the first useful observation point. Ask for or infer: what the user expected, what actually happened, where the symptom appeared, whether it is an error/wrong result/no execution/slow/intermittent, and the smallest known reproduction step.

Output: plain-language restatement, known facts, unknowns, first useful observation point, why this point, next step.

#### Stage 2: Choose The Observation Method

Choose logs, breakpoints, or both for the next observation. The agent chooses; the user does not have to.

- Use temporary logs when: flow is long/async/repeated/crosses modules, problem is intermittent, need ordered timeline.
- Use breakpoints when: problem is stable and reproducible, suspected location is narrow, need to inspect variables at one exact moment.
- Use logs first then breakpoints when: exact location unknown, need to narrow the path first.

#### Stage 3: Make The Problem Visible

Guide the user to see the problem reproduce. For logs: exact location, message format, variables to print, how to run, what different outputs mean. For breakpoints: exact location, trigger action, variables/call stack/return value to inspect.

#### Stage 4: Evidence-Based Narrowing

After each observation, update: what is confirmed, what is ruled out, which hypothesis remains, what the next smallest observation should be. Do not jump to fixing while the root cause is still only a guess.

#### Stage 5: Root Cause, Fix, And Verification

Root cause statement shape: "The symptom was [X]. The decisive evidence was [Y]. The root cause is [Z]. This explains the symptom because [reason]." Then provide: minimal fix, why it targets the cause, risk/side effect, verification command, regression check, cleanup step for temp logs/breakpoints.

#### Stage 6: Diagnostic Study Document

Produce a reusable summary preserving the investigation path. Distinguish symptom, evidence, hypothesis, conclusion, fix, verification, and learning notes.

### Framework Or Complex-System Problems

When the problem involves a framework, multi-agent system, plugin, hook, permission model, session, DB state, event bus, or tool chain, triage through these layers from outside to inside:

- Entry: did the command/request/action enter the system?
- Routing: did it reach the expected module, handler, agent, or service?
- Constraint: did permission, hook, plugin, config, feature flag, policy, or validation block it?
- Execution: did the core logic run?
- State: were DB, cache, session, context, grant, or runtime values correct?
- Output: was the result returned, displayed, emitted, or persisted?

### Response Style

Use the user's language. For a beginner, keep each step concrete. End each investigation turn with exactly one next action unless the user asks for a broader plan.
