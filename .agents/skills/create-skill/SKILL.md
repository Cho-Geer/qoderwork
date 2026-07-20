---
name: create-skill
version: 1.0.0
description: "Guides users through creating effective Agent Skills for QoderWork / 引导用户为 QoderWork 创建有效的 Agent 技能。Use when the user wants to create, write, or author a new skill, or asks about skill structure, best practices, or SKILL.md format. 触发词：create skill、创建技能、new skill、SKILL.md 格式、skill structure、skill best practices。不适用于安装已有技能、搜索技能市场、或修改已安装技能的描述。"
---

# Creating Skills in QoderWork

## Language / 语言

Follow the user's language: reply in Chinese for Chinese requests and English for English requests. Provide both only when requested; preserve code, commands, paths, API names, identifiers, and quoted source text exactly.

This skill guides you through creating effective Agent Skills for QoderWork. Skills are markdown files that teach the agent how to perform specific tasks: reviewing PRs using team standards, generating commit messages in a preferred format, querying database schemas, or any specialized workflow.

## Before You Begin: Gather Requirements

Before creating a skill, gather essential information from the user about:

1. **Purpose and scope**: What specific task or workflow should this skill help with?
2. **Trigger scenarios**: When should the agent automatically apply this skill?
3. **Key domain knowledge**: What specialized information does the agent need that it wouldn't already know?
4. **Output format preferences**: Are there specific templates, formats, or styles required?
5. **Existing patterns**: Are there existing examples or conventions to follow?

### Inferring from Context

If you have previous conversation context, infer the skill from what was discussed. You can create skills based on workflows, patterns, or domain knowledge that emerged in the conversation.

### Gathering Additional Information

If you need clarification, use the AskUserQuestion tool when available:

```
Example AskUserQuestion usage:
- "Should this skill include executable scripts?" with options like ["Yes", "No"]
```

If the AskUserQuestion tool is not available, ask these questions conversationally.

---

## Skill File Structure

### Directory Layout

Skills are stored as directories containing a `SKILL.md` file:

```
skill-name/
├── SKILL.md              # Required - main instructions
├── reference.md          # Optional - detailed documentation
├── examples.md           # Optional - usage examples
└── scripts/              # Optional - utility scripts
    ├── validate.py
    └── helper.sh
```

### Storage Location

Skills are stored as personal skills under the user's home directory. The exact path depends on the runtime environment:

| Environment | Path |
|-------------|------|
| Host (macOS/Linux) | ~/{{.DataDirName}}/skills/skill-name/ |
| Host (Windows) | %USERPROFILE%\\{{.DataDirName}}\skills\skill-name\ |
| VM / Container | /root/{{.DataDirName}}/skills/skill-name/ |

**Environment detection**: Use the `--resource-dir` value provided by the SDK at runtime, which resolves to the correct platform-specific path automatically. If you need to detect manually:
- **Windows**: Check if `process.platform === "win32"` or if the path separator is `\`. The skills directory is `%USERPROFILE%\{{.DataDirName}}\skills\`.
- **VM / Container**: Check whether `/root/{{.DataDirName}}` exists. If it does, use `/root/{{.DataDirName}}/skills/`.
- **Otherwise** (macOS/Linux host): Use `~/{{.DataDirName}}/skills/`.

### SKILL.md Structure

Every skill requires a `SKILL.md` file with YAML frontmatter and markdown body:

```markdown
---
name: your-skill-name
description: Brief description of what this skill does and when to use it
---

# Your Skill Name

## Instructions
Clear, step-by-step guidance for the agent.

## Examples
Concrete examples of using this skill.
```

### Required Metadata Fields

| Field | Requirements | Purpose |
|-------|--------------|---------|
| `name` | Max 64 chars, lowercase letters/numbers/hyphens only | Unique identifier for the skill |
| `description` | Max 1024 chars, non-empty | Helps agent decide when to apply the skill |

---

## Writing Effective Descriptions

The description is **critical** for skill discovery. The agent uses it to decide when to apply your skill.

### Description Best Practices

1. **Write in third person** (the description is injected into the system prompt):
   - Good: "Processes Excel files and generates reports"
   - Avoid: "I can help you process Excel files"
   - Avoid: "You can use this to process Excel files"

2. **Be specific and include trigger terms**:
   - Good: "Extract text and tables from PDF files, fill forms, merge documents. Use when working with PDF files or when the user mentions PDFs, forms, or document extraction."
   - Vague: "Helps with documents"

3. **Include both WHAT and WHEN**:
   - WHAT: What the skill does (specific capabilities)
   - WHEN: When the agent should use it (trigger scenarios)

### Description Examples

```yaml
# PDF Processing
description: Extract text and tables from PDF files, fill forms, merge documents. Use when working with PDF files or when the user mentions PDFs, forms, or document extraction.

# Excel Analysis
description: Analyze Excel spreadsheets, create pivot tables, generate charts. Use when analyzing Excel files, spreadsheets, tabular data, or .xlsx files.

# Git Commit Helper
description: Generate descriptive commit messages by analyzing git diffs. Use when the user asks for help writing commit messages or reviewing staged changes.

# Code Review
description: Review code for quality, security, and best practices following team standards. Use when reviewing pull requests, code changes, or when the user asks for a code review.
```

---

## Core Authoring Principles

### 1. Concise is Key

The context window is shared with conversation history, other skills, and requests. Every token competes for space.

**Default assumption**: The agent is already very smart. Only add context it doesn't already have.

Challenge each piece of information:
- "Does the agent really need this explanation?"
- "Can I assume the agent knows this?"
- "Does this paragraph justify its token cost?"

**Good (concise)**:
```markdown
## Extract PDF text

Use pdfplumber for text extraction:

```python
import pdfplumber

with pdfplumber.open("file.pdf") as pdf:
    text = pdf.pages[0].extract_text()
```
```

**Bad (verbose)**:
```markdown
## Extract PDF text

PDF (Portable Document Format) files are a common file format that contains
text, images, and other content. To extract text from a PDF, you'll need to
use a library. There are many libraries available for PDF processing, but we
recommend pdfplumber because it's easy to use and handles most cases well...
```

### 2. Keep SKILL.md Under 500 Lines

For optimal performance, the main SKILL.md file should be concise. Use progressive disclosure for detailed content.

### 3. Progressive Disclosure

Put essential information in SKILL.md; detailed reference material in separate files that the agent reads only when needed.

```markdown
# PDF Processing

## Quick start
[Essential instructions here]

## Additional resources
- For complete API details, see [reference.md](reference.md)
- For usage examples, see [examples.md](examples.md)
```

**Keep references one level deep** - link directly from SKILL.md to reference files. Deeply nested references may result in partial reads.

### 4. Set Appropriate Degrees of Freedom

Match specificity to the task's fragility:

| Freedom Level | When to Use | Example |
|---------------|-------------|---------|
| **High** (text instructions) | Multiple valid approaches, context-dependent | Code review guidelines |
| **Medium** (pseudocode/templates) | Preferred pattern with acceptable variation | Report generation |
| **Low** (specific scripts) | Fragile operations, consistency critical | Database migrations |

---

## 认知缺陷防护模式

在编写技能的执行步骤时，必须应用以下四种防护模式，防止 agent 跳过验证步骤。这四种模式源于 pre-flight-enforcement v2.2 的认知缺陷防护体系。

### 1. 步骤类型标注

每个步骤标注类型，让「这个步骤需要产生什么」显式化：

| 标注 | 含义 | 产生什么 | 示例 |
|------|------|---------|------|
| `[ANALYSIS]` | 分析/阅读/理解 | 仅产生理解，不产生运行态证据 | 源码分析、文档阅读、配置检查 |
| `[VERIFICATION]` | 验证/触发/测试 | 必须产生可引用的运行态证据 | API 调用、命令执行、测试运行 |
| `[OBSERVATION]` | 观察/检查/确认 | 基于 VERIFICATION 的证据做判断 | 检查日志、查看结果 |

**标注位置**：步骤标题末尾，如 `### Step 3: Run and Observe \`[VERIFICATION]\``

### 2. Verified-by 证据行

每个 `[VERIFICATION]` 步骤完成后，必须输出证据行：

```
Verified-by: <调用的端点/命令> -> <关键返回信息>
```

**如果写不出证据行，说明该步骤未实际执行，必须补做。**

### 3. 合理化检测

在容易跳步的环节添加合理化检测提示，格式：

```
> **合理化检测**：如果你发现自己在想「<跳步理由>」--停下来，这是跳步信号。<应该做什么>。
```

**常见跳步理由**（按场景选用）：
- 「代码已经清楚表明了问题根因，不需要运行」
- 「文件写好了，skill 肯定能用」
- 「刚装完肯定有了」
- 「配置已经改对了，工具肯定能用了」
- 「模拟校验通过了，提交肯定没问题」

### 4. 认知说明

在容易混淆 ANALYSIS 和 VERIFICATION 的环节添加认知说明，格式：

```
> **注意**：源码分析回答「代码意图是什么」，运行态验证回答「运行态实际是什么」。两者可能不一致。<列举可能不一致的原因>。
```

### 何时应用

| 场景 | 必须应用 | 原因 |
|------|---------|------|
| 技能有「验证」「测试」「确认」步骤 | 1+2+3 | 验证步骤最容易被跳过 |
| 技能有「分析代码 -> 运行验证」流程 | 1+2+3+4 | ANALYSIS vs VERIFICATION 混淆高发 |
| 技能纯操作型（如文档处理） | 不需要 | 无混淆空间 |
| 技能有「模拟校验 -> 真实执行」流程 | 1+3+4 | 模拟≠真实是高发陷阱 |

---

## Common Patterns

### Template Pattern

Provide output format templates:

```markdown
## Report structure

Use this template:

```markdown
# [Analysis Title]

## Executive summary
[One-paragraph overview of key findings]

## Key findings
- Finding 1 with supporting data
- Finding 2 with supporting data

## Recommendations
1. Specific actionable recommendation
2. Specific actionable recommendation
```
```

### Examples Pattern

For skills where output quality depends on seeing examples:

```markdown
## Commit message format

**Example 1:**
Input: Added user authentication with JWT tokens
Output:
```
feat(auth): implement JWT-based authentication

Add login endpoint and token validation middleware
```

**Example 2:**
Input: Fixed bug where dates displayed incorrectly
Output:
```
fix(reports): correct date formatting in timezone conversion

Use UTC timestamps consistently across report generation
```
```

### Workflow Pattern

Break complex operations into clear steps with checklists:

```markdown
## Form filling workflow

Copy this checklist and track progress:

```
Task Progress:
- [ ] Step 1: Analyze the form
- [ ] Step 2: Create field mapping
- [ ] Step 3: Validate mapping
- [ ] Step 4: Fill the form
- [ ] Step 5: Verify output
```

**Step 1: Analyze the form**
Run: `python scripts/analyze_form.py input.pdf`
...
```

### Conditional Workflow Pattern

Guide through decision points:

```markdown
## Document modification workflow

1. Determine the modification type:

   **Creating new content?** -> Follow "Creation workflow" below
   **Editing existing content?** -> Follow "Editing workflow" below

2. Creation workflow:
   - Use docx-js library
   - Build document from scratch
   ...
```

### Feedback Loop Pattern

For quality-critical tasks, implement validation loops:

```markdown
## Document editing process

1. Make your edits
2. **Validate immediately**: `python scripts/validate.py output/`
3. If validation fails:
   - Review the error message
   - Fix the issues
   - Run validation again
4. **Only proceed when validation passes**
```

---

## Utility Scripts

Pre-made scripts offer advantages over generated code:
- More reliable than generated code
- Save tokens (no code in context)
- Save time (no code generation)
- Ensure consistency across uses

```markdown
## Utility scripts

**analyze_form.py**: Extract all form fields from PDF
```bash
python scripts/analyze_form.py input.pdf > fields.json
```

**validate.py**: Check for errors
```bash
python scripts/validate.py fields.json
# Returns: "OK" or lists conflicts
```
```

Make clear whether the agent should **execute** the script (most common) or **read** it as reference.

---

## Anti-Patterns to Avoid

### 1. Windows-Style Paths
- Use: `scripts/helper.py`
- Avoid: `scripts\helper.py`

### 2. Too Many Options
```markdown
# Bad - confusing
"You can use pypdf, or pdfplumber, or PyMuPDF, or..."

# Good - provide a default with escape hatch
"Use pdfplumber for text extraction.
For scanned PDFs requiring OCR, use pdf2image with pytesseract instead."
```

### 3. Time-Sensitive Information
```markdown
# Bad - will become outdated
"If you're doing this before August 2025, use the old API."

# Good - use an "old patterns" section
## Current method
Use the v2 API endpoint.

## Old patterns (deprecated)
<details>
<summary>Legacy v1 API</summary>
...
</details>
```

### 4. Inconsistent Terminology
Choose one term and use it throughout:
- Always "API endpoint" (not mixing "URL", "route", "path")
- Always "field" (not mixing "box", "element", "control")

### 5. Vague Skill Names
- Good: `processing-pdfs`, `analyzing-spreadsheets`
- Avoid: `helper`, `utils`, `tools`

---

## Skill Creation Workflow

When helping a user create a skill, follow this process:

### Phase 1: Discovery `[ANALYSIS]`

Gather information about:
1. The skill's purpose and primary use case
2. Trigger scenarios
3. Any specific requirements or constraints
4. Existing examples or patterns to follow

If you have access to the AskUserQuestion tool, use it for efficient structured gathering. Otherwise, ask conversationally.

### Phase 2: Design `[ANALYSIS]`

1. Draft the skill name (lowercase, hyphens, max 64 chars)
2. Write a specific, third-person description
3. Outline the main sections needed
4. Identify if supporting files or scripts are needed

### Phase 3: Implementation `[ANALYSIS]`

1. Create the directory structure
2. Write the SKILL.md file with frontmatter
3. Create any supporting reference files
4. Create any utility scripts if needed

### Phase 4: Verification `[VERIFICATION]`

> **注意**：本阶段的验证必须产出运行态证据，不是自检。Phase 1-3 是 `[ANALYSIS]`（设计+编写），Phase 4 是 `[VERIFICATION]`（实际验证 skill 能被发现和应用）。
> **合理化检测**：如果你发现自己在想「文件写好了，skill 肯定能用」--停下来，这是跳步信号。必须实际验证。

1. Verify the SKILL.md is under 500 lines
   - `Verified-by: wc -l SKILL.md -> 行数`
2. Check that the description is specific and includes trigger terms
   - `Verified-by: grep -c 'Trigger\|Use when\|触发' SKILL.md -> 匹配数`
3. Ensure consistent terminology throughout
   - `Verified-by: 人工检查 + 确认无术语混用`
4. Verify all file references are one level deep
   - `Verified-by: grep -n '\[[^]]\+\](reference.md\|examples.md\|STANDARDS.md)' SKILL.md -> 本地引用均指向现有文件`
5. Test that the skill can be discovered and applied
   - `Verified-by: qw_query({ key: "qoderwork.settings.skills" }) -> 确认新 skill 出现在列表中`
   - 如果 serve API 可用：`Verified-by: 创建 session + 发送触发消息 -> 确认 skill 被加载（SSE 事件中有 skill 相关日志）`

---

## Complete Example

Here's a complete example of a well-structured skill:

**Directory structure:**
```
code-review/
├── SKILL.md
├── STANDARDS.md
└── examples.md
```

**SKILL.md:**
```markdown
---
name: code-review
description: Review code for quality, security, and maintainability following team standards. Use when reviewing pull requests, examining code changes, or when the user asks for a code review.
---

# Code Review

## Quick Start

When reviewing code:

1. Check for correctness and potential bugs
2. Verify security best practices
3. Assess code readability and maintainability
4. Ensure tests are adequate

## Review Checklist

- [ ] Logic is correct and handles edge cases
- [ ] No security vulnerabilities (SQL injection, XSS, etc.)
- [ ] Code follows project style conventions
- [ ] Functions are appropriately sized and focused
- [ ] Error handling is comprehensive
- [ ] Tests cover the changes

## Providing Feedback

Format feedback as:
- **Critical**: Must fix before merge
- **Suggestion**: Consider improving
- **Nice to have**: Optional enhancement

## Additional Resources

- For detailed coding standards, see [STANDARDS.md](STANDARDS.md)
- For example reviews, see [examples.md](examples.md)
```

---

## Summary Checklist

Before finalizing a skill, verify:

### Core Quality
- [ ] Description is specific and includes key terms
- [ ] Description includes both WHAT and WHEN
- [ ] Written in third person
- [ ] SKILL.md body is under 500 lines
- [ ] Consistent terminology throughout
- [ ] Examples are concrete, not abstract

### Structure
- [ ] File references are one level deep
- [ ] Progressive disclosure used appropriately
- [ ] Workflows have clear steps
- [ ] No time-sensitive information

### 认知缺陷防护
- [ ] 验证步骤标注了 `[VERIFICATION]`，分析步骤标注了 `[ANALYSIS]`
- [ ] 每个 `[VERIFICATION]` 步骤有 `Verified-by:` 证据行要求
- [ ] 易跳步环节有合理化检测提示（「如果你发现自己在想 X--停下来」）
- [ ] 易混淆环节有 ANALYSIS vs VERIFICATION 认知说明

### If Including Scripts
- [ ] Scripts solve problems rather than punt
- [ ] Required packages are documented
- [ ] Error handling is explicit and helpful
- [ ] No Windows-style paths
