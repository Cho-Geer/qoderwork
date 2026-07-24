# RULES.md — 输出格式契约

> **定位**：本文件约束每次回答的输出结构（ID/TASK/PLAN/EVIDENCE/RESULT/CHECK/FINAL）与验证标记。
> **加载机制**：OpenCode SDK 不自动加载本文件（二进制零识别），依赖 AGENTS.md §5 第1条强制读取。
> **与 AGENTS.md 的关系**：代码风格详见 AGENTS.md §7，验证层级详见 AGENTS.md §4.3。本文件不重复这些内容，仅保留输出格式契约与简略提醒。

---

1. Think step by step: 先理解需求，再拆分关键步骤，再执行，再 self-check。

2. Every response/task must start with a unique string ID.

3. Default output structure must be:

### ID
- [ID] <unique-string>

### TASK
- [REQ] 当前需求
- [SCOPE] 处理范围
- [GOAL] 目标结果
- [MODE] SINGLE / SUBAGENT / MULTI-AGENT

### PLAN
- [S1][TODO/DOING/DONE/BLOCKED] 子任务1
- [S2][TODO/DOING/DONE/BLOCKED] 子任务2

### EVIDENCE
- [E1][VERIFIED/UNVERIFIED] 证据1
- [E2][VERIFIED/UNVERIFIED] 证据2

### RESULT
- [R1] 关键结果1
- [R2] 关键结果2

### CHECK
- [TEST] PASS / FAIL / NOT-RUN / N/A
- [DOC] UPDATED / N/A
- [RISK] NONE / OPEN: <summary>

### FINAL
- 最终结论

4. For simple questions, keep the same structure but reduce PLAN / EVIDENCE / RESULT to the minimum necessary. Do not omit ID, TASK, CHECK, FINAL.

5. Default to [MODE] SUBAGENT or [MODE] MULTI-AGENT.
Main agent handles reasoning, planning, auditing. Sub-agents handle execution.
Use [MODE] SINGLE only when the task is too small to decompose or requires main agent's direct design judgment.

6. Do not dispatch subagents for:
- very small tasks requiring judgment (mechanical small tasks may be delegated to cheap sub-agents)
- strongly sequential tasks
- tasks with heavy shared-file overlap
- tasks requiring one unified final judgment or one tightly coupled implementation path

7. When dispatching, explicitly define:
- subtask goal
- scope boundary
- expected deliverable
- ownership or focus area
- required evidence
Avoid overlapping ownership whenever possible.

8. When generating code, prioritize correctness, readability, maintainability.
Add comments only when necessary:
- file-level comment
- class/module-level comment
- function/method-level comment
- key inline comments for non-obvious logic
Do not add mechanical line-by-line comments.
JSON documents excluded.
> 完整代码风格规范详见 AGENTS.md §7。

9. Do not present unverified claims as verified facts.
Use explicit markers:
- [VERIFIED]
- [UNVERIFIED]
- [BLOCKED]
- [RISK]

10. Use the right validation level for the task:
- unit
- integration
- E2E
- manual verification

Use TestContainers only when real containerized dependencies are required.
> 完整验证层级定义（含 component/runtime-smoke/live-LLM-E2E）详见 AGENTS.md §4.3。