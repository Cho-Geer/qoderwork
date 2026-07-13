---
name: doc-code-sync
description: "Maintain the documents/INDEX.md index file for the qoderwork project. Scans all .md documents, compares against current index, rewrites with updated summaries, line counts, and reading recommendations. Triggers: document index sync, INDEX.md update, 文档索引同步, session startup doc sync, 文档更新后同步索引. Not for: creating new documents, editing document content, or non-qoderwork projects."
agent_created: true
---

# Doc Code Sync (文档代码同步)

## Overview

Maintain `/home/zhaoge/workspace/qoderwork/documents/INDEX.md` — the master index of all project documents. The skill detects new or changed documents, generates concise Chinese summaries, and rewrites INDEX.md while preserving its established format (header notes + table + scenario recommendations).

## When to Use

- **Session startup** — verify the index is current before consulting documents
- **After adding or modifying** any `.md` file in `documents/`
- **User requests** like "更新文档索引", "同步 INDEX.md", "sync documents", "文档代码同步"
- **Before referencing documents** to ensure the index reflects reality

## Paths

| Resource | WSL Path | UNC Path (fallback) |
|----------|----------|---------------------|
| Documents dir | `/home/zhaoge/workspace/qoderwork/documents/` | `\\wsl.localhost\Ubuntu-24.04\home\zhaoge\workspace\qoderwork\documents\` |
| Index file | `.../documents/INDEX.md` | `...\documents\INDEX.md` |

## Access Methods

**Method A — WSL bash (preferred, if enabled):**
```
wsl -d Ubuntu-24.04 bash -c "cd /home/zhaoge/workspace/qoderwork/documents && <command>"
```

**Method B — UNC paths (fallback when WSL is disabled):**
Use Glob, Read, and Bash tools with `//wsl.localhost/Ubuntu-24.04/home/zhaoge/workspace/qoderwork/...` paths. Bash commands (ls, wc, stat, cp) work on UNC paths from the Windows shell.

> Detect which method is available by attempting a simple WSL command first. If it returns "SYSTEM TOOL DISABLED", switch to Method B for the entire workflow.

## Workflow

### Step 1: Collect Document Metadata

List all `.md` files in `documents/` **excluding** `INDEX.md`. For each file, gather:
- **Filename** (basename only)
- **Line count** (`wc -l`)
- **Modification time** (`stat -c '%y'`, truncated to seconds)

**WSL command:**
```bash
cd /home/zhaoge/workspace/qoderwork/documents && for f in *.md; do [ "$f" = "INDEX.md" ] && continue; lines=$(wc -l < "$f"); mtime=$(stat -c '%y' "$f" | cut -d'.' -f1); echo "$f|$lines|$mtime"; done
```

**UNC fallback (Bash tool):**
```bash
cd "//wsl.localhost/Ubuntu-24.04/home/zhaoge/workspace/qoderwork/documents" && for f in *.md; do [ "$f" = "INDEX.md" ] && continue; lines=$(wc -l < "$f"); mtime=$(stat -c '%y' "$f" | cut -d'.' -f1); echo "$f|$lines|$mtime"; done
```

Also record INDEX.md's own modification time for the comparison step:
```bash
stat -c '%y' "<path>/INDEX.md" | cut -d'.' -f1
```

### Step 2: Read Current INDEX.md

Read `documents/INDEX.md` in full. Parse out:
- The table rows (filename → current recorded line count + summary)
- The "按场景推荐阅读" (scenario recommendations) section
- The existing "最近更新" / "历史更新" notes

### Step 3: Compare & Detect Changes `[VERIFICATION]`

> **本步骤是 `[VERIFICATION]`**--必须实际运行文件计数/行数对比命令，记录 `Verified-by: 实际 wc -l / find 输出`。「文档看起来和代码一致」不是验证。

A document needs re-summarizing if **any** of these are true:
1. **New file** — exists in `documents/` but not in INDEX.md table
2. **Newer than INDEX.md** — document mtime > INDEX.md mtime
3. **Line count drift** — actual line count differs from INDEX.md recorded count by more than ±2 lines (ignore minor ±1 drift from trailing newlines)

If **zero changes** detected → stop, report "INDEX.md is up to date", make no modifications.

### Step 4: Read & Summarize Changed Documents

For each new or changed document:
1. Read the full file content
2. Generate a one-line summary using these rules:
   - **Language**: Chinese (中文)
   - **Length**: ≤ 50 Chinese characters (the summary cell, excluding filename/topic)
   - **Content**: topic + content overview — what the document covers, its scope, and who it's for
   - **Style**: concise, information-dense, no filler words
   - **Format**: `<内容概述>。面向<目标读者>。`

**Summary quality examples (from existing INDEX.md):**
- Good: "五种 ID 辨析（Session/Gate/DAG/Agent/Namespace）、Session 生命周期、session_map 三层存储、状态机、与 SDK session 表的关系。面向 Session 相关 Bug 排查和架构理解。"
- Good: "OpenCode CLI 全命令参考（run/serve/web/acp）、ACP 协议 stdio JSON-RPC 2.0 交互流程、session 生命周期管理、QoderWork↔OpenCode 双向通道设计。面向 ACP 桥接开发调试。"

### Step 5: Rewrite INDEX.md

Reconstruct INDEX.md with this exact structure:

```markdown
# Documents 索引

> 本文件由 QoderWork Session Startup 自动扫描。新增文档时请同步更新此索引。
>
> **最近更新**: YYYY-MM-DD — <一句话说明本次同步内容>：
> - **新增/更新**: <文件名> — <变更说明>
> - ...
>
> **历史更新**: <保留上一条的摘要，压缩为 1-2 行>

| 文件 | 主题 | 摘要 | 行数 |
|------|------|------|------|
| <filename.md> | <主题> | <摘要> | ~<lines> |
| ... |

## 按场景推荐阅读

- **<场景描述>** → <filename.md>
- ...
```

**Table formatting rules:**
- Bold (`**`) the 1-3 most important / entry-point documents (entire row: filename, topic, summary, lines)
- Line count prefixed with `~` (approximate)
- Files ordered by importance, not alphabetically — cognitive-map first, then by topic depth
- Keep the "历史更新" block: compress the previous "最近更新" into 1-2 lines

**Scenario recommendations rules:**
- Group by use case: "初次了解框架", "调试 XXX", "排查 XXX", "理解 XXX", "查 XXX"
- One scenario → one document (or section reference like `§3-4`)
- Order: beginner entry points first, then debugging, then deep-dive
- Update this section whenever document content changes shift the best entry point for a scenario

### Step 6: Write the File

**Critical**: Do NOT use the Write/Edit tools directly on UNC paths (`\\wsl.localhost\...`) — they may be rejected by the sandbox.

**Procedure:**
1. Write the new INDEX.md content to a Windows temp file using the Write tool:
   - Path: `C:\Users\USER\AppData\Local\Temp\doc-index-sync.md`
2. Copy to the WSL documents directory using Bash:
   - **WSL method**: `wsl -d Ubuntu-24.04 bash -c "cp /mnt/c/Users/USER/AppData/Local/Temp/doc-index-sync.md /home/zhaoge/workspace/qoderwork/documents/INDEX.md"`
   - **UNC fallback**: `cp "C:/Users/USER/AppData/Local/Temp/doc-index-sync.md" "//wsl.localhost/Ubuntu-24.04/home/zhaoge/workspace/qoderwork/documents/INDEX.md"`

### Step 7: Report

Report to the user:
- Number of new files added
- Number of files updated (re-summarized)
- Files unchanged
- A brief diff summary (which rows changed and how)

## Key Conventions

- **Architecture counts** referenced in summaries must match the verified facts in `.workbuddy/memory/MEMORY.md`:
  - Agent: 5 (opencode.json actual; design blueprint 10 roles), Plugin: 5, Plugin Handler: 39 (before 20 + after 19), 自定义 Tool: 37 (`.opencode/tools/*.ts`), Lib: 51, MCP Server: 12, DB 表: 50 (54 CREATE - 4 DROP), Schema: v37
  - If a document cites a different number, flag it to the user but do NOT auto-correct the document — only fix the INDEX.md summary to match the document's actual content.
- **No false updates**: if nothing changed, do NOT rewrite the file. Touching the file unnecessarily creates noise in git diff.
- **Preserve history**: always carry forward the previous "最近更新" as "历史更新" (compressed to 1-2 lines). Never discard update history entirely — keep at least the most recent prior entry.
- **Summaries reflect document content, not external truth**: the INDEX.md summary describes what the document says, not what the codebase actually is. If the document is wrong, that's a document fix, not an index fix.
