# L1-002 Re-run Evidence Bundle

- **Generated**: 2026-07-12T07:01:38Z
- **Case**: L1-002 — trivial task does not inject heavy/full prompt behavior
- **Harness**: serve API (localhost:4096) + instrumented skill-summary.ts probe
- **Sessions**: EN=ses_0aae4e718ffeoYANED7N6apGYn, CN=ses_0aae3dc1cffeT6U8U95pfBINzI

## Result: PASS

## 1. Prompt/System Evidence (SKILL-SUMMARY-DIRECTIVE)

Both trivial tasks were classified `risk: trivial` with `todo: not-needed`, 
`freshness: not-needed`, `preflight: optional`, and the directive explicitly states 
**"No legacy preamble or DAG gate is required for small safe tasks."**

Captured directive count for the two L1-002 sessions: **3**

### session ses_0aae4e718ffeoYANED7N6apGYn
- risk: `trivial`
- todo: `not-needed`
- freshness: `not-needed`
- directive text:
```
[SKILL-SUMMARY] Agent: Orchestrator
Risk: trivial
Recommended: preflight-lite, context7-first, codegraph-first, opencode-mcp-integration, multi-agent-orchestration, dispatch-protocol, deliverable-contract, review-arbitration
TodoWrite: optional for this task. Skip it only if the task remains truly trivial.
Freshness: not required unless you discover version-sensitive assumptions.
Preflight: optional. Skip preflight-lite for trivial read-only queries.
Use 'skill' tool to load execution skills before complex work. 'skill_read_attest' certifies required skill reads.
For source edits: load codegraph-first FIRST. For complex tasks: load brainstorming. No legacy preamble or DAG gate is required for small safe tasks.
```

### session ses_0aae4e718ffeoYANED7N6apGYn
- risk: `trivial`
- todo: `not-needed`
- freshness: `not-needed`
- directive text:
```
[SKILL-SUMMARY] Agent: Orchestrator
Risk: trivial
Recommended: preflight-lite, context7-first, codegraph-first, opencode-mcp-integration, multi-agent-orchestration, dispatch-protocol, deliverable-contract, review-arbitration
TodoWrite: optional for this task. Skip it only if the task remains truly trivial.
Freshness: not required unless you discover version-sensitive assumptions.
Preflight: optional. Skip preflight-lite for trivial read-only queries.
Use 'skill' tool to load execution skills before complex work. 'skill_read_attest' certifies required skill reads.
For source edits: load codegraph-first FIRST. For complex tasks: load brainstorming. No legacy preamble or DAG gate is required for small safe tasks.
```

### session ses_0aae3dc1cffeT6U8U95pfBINzI
- risk: `trivial`
- todo: `not-needed`
- freshness: `not-needed`
- directive text:
```
[SKILL-SUMMARY] Agent: Orchestrator
Risk: trivial
Recommended: preflight-lite, context7-first, codegraph-first, opencode-mcp-integration, multi-agent-orchestration, dispatch-protocol, deliverable-contract, review-arbitration
TodoWrite: optional for this task. Skip it only if the task remains truly trivial.
Freshness: not required unless you discover version-sensitive assumptions.
Preflight: optional. Skip preflight-lite for trivial read-only queries.
Use 'skill' tool to load execution skills before complex work. 'skill_read_attest' certifies required skill reads.
For source edits: load codegraph-first FIRST. For complex tasks: load brainstorming. No legacy preamble or DAG gate is required for small safe tasks.
```

## 2. Agent Actual Behavior (assistant responses)

### EN session (ses_0aae4e718ffeoYANED7N6apGYn)
```
You can show the current Git branch with:

```bash
git branch --show-current
```

Or the classic:

```bash
git rev-parse --abbrev-ref HEAD
```

Let me check the current branch for you:


Current branch: **`work-one`**

Two commands to show it:

| Command | Example Output |
|---------|---------------|
| `git branch --show-current` | `work-one` |
| `git rev-parse --abbrev-ref HEAD` | `work-one` |

The first (`--show-current`) is simpler and more modern; the second (`rev-parse`) works on older Git versions. Either works fine.
```

### CN session (ses_0aae3dc1cffeT6U8U95pfBINzI)
```
查看当前 Git 分支最简单、最常用的命令是：

```bash
git branch --show-current
```

或者你也可以用：

```bash
git rev-parse --abbrev-ref HEAD
```

两者的区别：
- `git branch --show-current`（Git 2.22+）：直接输出当前分支名，简洁明了
- `git rev-parse --abbrev-ref HEAD`：更底层，兼容性更好（旧版 Git 也能用）

另外，`git branch` 会列出所有本地分支，当前分支前面会有一个 `*` 号标记。
```

## 3. Assertion Verification

| Assertion | Expected | Observed | Verdict |
|---|---|---|---|
| Risk classified trivial | trivial | trivial | PASS |
| TodoWrite not forced | optional | optional | PASS |
| Freshness not forced | not-required | not-required | PASS |
| Preflight not forced | optional | optional | PASS |
| No legacy preamble / DAG gate | absent | 'No legacy preamble or DAG gate is required' | PASS |
| Agent answers directly (no ceremony) | direct answer | direct answer (EN added one read-only verify call) | PASS |

## 4. Notes
- EN agent made ONE optional read-only shell call to verify the branch name; this is the agent's own reasonable choice, NOT forced by the prompt. The system prompt explicitly left preflight/TodoWrite optional.
- CN agent answered directly with no tool call.
- P0-A repo has pre-existing feature-branch modifications (unrelated to this run); only skill-summary.ts was temporarily instrumented. CodeGraph CLI not on PATH in this shell (N/A to prompt-shaping).
