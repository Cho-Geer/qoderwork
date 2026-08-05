---
name: guided-code-editing
description: "Guide the user through manual code edits from a blueprint, plan, or priority todo list / 指导用户根据蓝图、计划或优先级待办列表手动编辑代码。Explain what file to change, who calls it, why the change matters, and how to verify it step by step. Trigger: guide me, 指导我修改, walk me through, manual edit, blueprint task, plan task. Not for: tasks where the agent should directly edit code or own the implementation end to end."
---

# Guided Code Editing

## Language / 语言

Follow the user's language: reply in Chinese for Chinese requests and English for English requests. Provide both only when requested; preserve code, commands, paths, API names, identifiers, and quoted source text exactly.

Guide the user through manually modifying code, one task at a time. The user is the editor; you are the mentor.

## When to Use

- User has a blueprint, plan, or prioritized todo list and wants to work through it.
- User says "guide me", "指导我修改", "walk me through", "下一步是什么".
- User wants to understand *why* each change is made, not just *what* to change.
- Agent should NOT directly edit code — the user edits, the agent guides.

## Core Principle

**Every modification step has four phases: Analyze → Explain → Guide Edit → Verify.**

Skipping any phase produces blind edits. The user must understand the change before making it, and verify after making it.

## The 6-Step Guided Editing Loop

For each task item in the priority list:

### Step 1: Impact Analysis `[ANALYSIS]`

Before touching any code, understand the blast radius:

```bash
# In work-one directory
codegraph callers "<symbol-name>"
codegraph impact "<symbol-name>"
codegraph callees "<symbol-name>"
```

Also grep for direct references:
```bash
grep -rn "<symbol>(" --include="*.ts" .opencode/ | grep -v __tests__ | grep -v "export function"
```

Output: a list of callers, which are active (in `project.config.json` `plugin_execution_order`), which are dead/test/legacy.

> **注意**：CodeGraph callers 回答「代码中谁引用了这个符号」，grep 补充确认「哪些是 active runtime 路径」。两者结合才能判断删除安全性。符号被 import 但调用方本身是 dead 代码，仍可以安全删除。

### Step 2: Read Target Code `[ANALYSIS]`

Read the exact lines to be modified:

```bash
sed -n '<start>,<end>p' <file>
```

Or use Read tool with offset/limit. Confirm:
- Exact function signature and body
- Surrounding context (imports, exports, comments)
- Any `@deprecated` markers or legacy notes

### Step 3: Explain to User `[ANALYSIS]`

Before giving edit instructions, explain in plain language:

| Question to Answer | How to Find It |
|---|---|
| **What file?** | Step 2 read result |
| **What function/symbol?** | Task description + Step 2 |
| **Who calls it?** | Step 1 callers list |
| **Which callers are active?** | Cross-reference with `plugin_execution_order` |
| **Why change here?** | Blueprint/plan rationale + bug evidence |
| **What goal?** | The end state this change achieves |
| **What's safe to delete?** | Active callers = keep; dead callers = safe to remove |

Format the explanation as a short narrative, not a data dump. The user should understand *why* before *what*.

> **认知说明**：源码分析回答“改哪里、为什么改”；运行态验证回答“改完后是否真的成立”。分析正确不等于编辑完成。

### Step 4: Guide Edit `[VERIFICATION]`

Give precise edit instructions. The user executes; you do not.

**For deletions**: specify exact line ranges and the content to remove.
```
Delete lines X-Y in <file> — the <symbol> function definition (already confirmed dead in Step 1).
```

**For modifications**: give old_string → new_string with enough context to be unique.
```
In <file>, find:
  <old code with surrounding context>
Replace with:
  <new code>
```

**For barrel re-exports**: list each file and the exact line to remove.
```
Remove `isWriteAllowed,` from:
1. service/gate/index.ts:82
2. lib/gate-checks.ts:8
```

Always specify:
- Which file(s)
- What to change (delete/replace/insert)
- Enough context to locate uniquely

Verified-by: user pasted the edited snippet or exact diff context for the named file.

### Step 5: Guide Verification `[VERIFICATION]`

After the user reports the edit is done, guide verification:

```bash
# 1. Confirm no residual references (should return empty)
grep -rn "<symbol>" --include="*.ts" .opencode/ | grep -v __tests__

# 2. Run test regression (NOTE: bun test requires ./ prefix for paths)
cd ${WORK_ONE_ROOT}
bun test ./.opencode/lib/__tests__/<relevant-test>.ts
```

> **合理化检测**：如果你发现自己在想「改动很小，不需要跑测试」--停下来，这是跳步信号。必须实际运行测试确认零回归。

> **bun test 路径陷阱**：`bun test .opencode/...` 会把参数当成文件名过滤器而非路径。必须用 `./.opencode/...` 前缀。这是高频踩坑点。

Verified-by 要求：用户必须贴回测试输出，agent 确认 PASS 后才进入下一个任务。

### Step 6: Debug if Fails `[VERIFICATION]`

If tests fail or behavior is unexpected, apply Log-First debugging:

1. **Form hypothesis** (< 2 min): based on error message, what broke?
2. **Insert investigation logs**: `[DEBUG-TMP]` markers at suspected points
3. **Run and capture**: actual runtime behavior
4. **Locate root cause**: from log evidence, not source-reading speculation
5. **Fix → clean up temp logs → re-verify**

For WSL/Bun execution issues, use the script-to-/tmp pattern:
```bash
# Write .ts to /tmp, run with explicit PATH
wsl -d "${QW_WSL_DISTRO:-Ubuntu-24.04}" bash -c "export PATH='${HOME}/.bun/bin:/usr/local/bin:/usr/bin:/bin' && cd ${WORK_ONE_ROOT} && bun run /tmp/verify.ts"
```

See [reference.md](reference.md) for detailed debug patterns and WSL script mode.

Verified-by: failing command output + `[DEBUG-TMP]` evidence + rerun result.

## Task Progression Rules

### One task at a time
Never batch multiple tasks into one explanation. Complete the full 6-step loop for one task before starting the next.

### Update progress tracking
After each task completes:
- Update TodoWrite to mark the task done
- Note what was changed, what was verified, what's next
- If switching models or sessions, write a progress log to `logs/`

### Dependency awareness
Before starting a task, check if it depends on prior tasks:
```
Task #5 (legacy-agent-permissions retirement) depends on Task #3 (getAgentShellAllowlist migration).
Don't start #5 until #3 is done.
```

### Dead code safety check
Before guiding deletion of any symbol, confirm ALL of:
1. Zero active runtime callers (grep + cross-reference plugin_execution_order)
2. Zero test dependencies, OR tests that can be updated
3. Only barrel re-exports remain (safe to remove)
4. No `@deprecated` note references it from active code paths

If any of these are uncertain, do NOT guide deletion. Flag the uncertainty and investigate further.

## Explanation Quality Checklist

For each Step 3 explanation, verify:

- [ ] Stated which file and which symbol
- [ ] Listed callers (from CodeGraph)
- [ ] Distinguished active vs dead callers
- [ ] Explained why this change is needed (blueprint rationale or bug evidence)
- [ ] Stated the goal (what end state this achieves)
- [ ] Confirmed what's safe to delete (if deletion task)

## What NOT to Do

- Do not directly Edit/Write the target code files. The user edits.
- Do not skip Step 1 (impact analysis) because "the change is small".
- Do not skip Step 5 (verification) because "the edit looks correct".
- Do not batch multiple tasks into one explanation.
- Do not claim a task is done without seeing the user's test output.
- Do not give vague instructions like "remove the deprecated function" without specifying exact lines.
