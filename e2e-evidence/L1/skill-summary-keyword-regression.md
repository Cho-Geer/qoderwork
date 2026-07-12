# Skill-Summary 中英文关键词回归矩阵 (Bilingual Keyword Matrix)

> 依据: `plans/02-phase1-skill-first.md` §2 + 本仓库 `work-one/.opencode/plugin-handlers/system/skill-summary.ts` (v2.3)
> 方法（v2，2026-07-11 全量 live LLM E2E）: 通过 **真实 serve API**（`127.0.0.1:4096`，Orchestrator，deepseek-v4-flash）对每条 prompt 创建独立真实 session 并 POST 用户消息；`skill-summary` 在 `experimental.chat.system.transform` 首轮即运行，从真实 `plugin-plugin-skill-summary-runtime.log` 抓取 `SKILL-SUMMARY-INJECTED` 事件。
> 证据脚本: `qoderwork/scripts/_e2e_b1_live.py` ｜ 明细: `qoderwork/scripts/_e2e_b1_results.tsv` ｜ 日志: `work-one/.task_temp/_logs/2026-07-11/plugin-plugin-skill-summary-runtime.log`
> 证据等级: **live LLM E2E**（2026-07-11 实测，24 条 CN+EN 全部在真实 serve session 命中日志；与 runtime-smoke 结果一致，互相验证）
> ⚠️ live 测试中 `agent` 由 `resolveAgent` 解析为 `Orchestrator` → base = `AGENT_SKILLS.Orchestrator`(8)。**keyword-boost 与 base 无关，下表「实际」列即 boost。**

## 12 意图 × 双语实测结果（live LLM E2E）

| # | 中文任务 (prompt) | English task (prompt) | 设计意图 Skill | 实际-CN boost (live) | 实际-EN boost (live) | CN==EN? | 证据等级 |
|---|---|---|---|---|---|---|---|
| 1 | 需求不清，先帮我澄清到底要做什么 | The requirements are unclear — help me clarify what we actually need to build | brainstorming | `brainstorming` | `ci-cd-guardrails,cross-directory-ci` ❌ | **否** | live LLM E2E |
| 2 | 修改 `.opencode/tools/safe_edit.ts` 的实现逻辑 | Modify the implementation logic in `.opencode/tools/safe_edit.ts` | codegraph-first | `codegraph-first` | `codegraph-first` | 是 | live LLM E2E |
| 3 | 修改 OpenCode 框架的 before hook 做路径校验 | Edit the OpenCode framework's before hook to add path validation | codegraph-first | `codegraph-first,ci-cd-guardrails,cross-directory-ci` ⚠️ | `brainstorming` ⚠️ | **否** | live LLM E2E |
| 4 | 把一个子任务 dispatch 给 build agent 去执行 | Dispatch a subtask to the build agent for execution | dispatch-protocol (base) | `ci-cd-guardrails,cross-directory-ci` ❌ | `ci-cd-guardrails,cross-directory-ci` ❌ | 是(同错) | live LLM E2E |
| 5 | 交付前帮我做验收，确认产出达标 | Before delivery, help me do acceptance and confirm the output meets the bar | deliverable-contract (base) | `none` | `none` | 是 | live LLM E2E |
| 6 | 给项目加一条 CI 流水线，跑 lint 和测试 | Add a CI pipeline to the project that runs lint and tests | ci-cd-guardrails,cross-directory-ci | `ci-cd-guardrails,cross-directory-ci` | `ci-cd-guardrails,cross-directory-ci` | 是 | live LLM E2E |
| 7 | 数据库迁移：把用户表拆成两张并迁移数据 | Database migration: split the user table into two and migrate the data | cicd-database-seeding,sqlite-bloat-investigation | `cicd-database-seeding,sqlite-bloat-investigation,context7-first` ❌ | `cicd-database-seeding,sqlite-bloat-investigation` | **否** | live LLM E2E |
| 8 | 查一下当前 axios 最新版本和 breaking change | Check the latest axios version and its breaking changes | context7-first | `codegraph-first,brainstorming,context7-first` ❌ | `ci-cd-guardrails,cross-directory-ci` ❌ | **否** | live LLM E2E |
| 9 | 这个偶发崩溃根因一直查不清，帮我系统调查 | This intermittent crash's root cause is hard to pin down — help me investigate systematically | investigation-evidence (未接入) | `none` | `none` | 是(同空) | live LLM E2E |
| 10 | 多份文档对同一个 API 行为说法冲突，帮我定论 | Multiple docs conflict on the same API's behavior — help me settle it | context7-first (API→context7) | `none` | `none` | 是(同空) | live LLM E2E |
| 11 | 修改框架源码：在 `before/codegraph.ts` 加一行日志 | Edit framework source: add a log line in `before/codegraph.ts` | codegraph-first | `codegraph-first` | `codegraph-first` | 是 | live LLM E2E |
| 12 | 一句话问答：Git 怎么看当前分支 | Quick question: how do I see the current Git branch? | none (trivial) | `none` | `none` | 是 | live LLM E2E |

> ⚠️ = live 与 in-process runtime-smoke 存在细微出入（见 F6）。其余 22 条 live 与 runtime-smoke 完全一致，互相验证。

## Live E2E 结果明细（24 真实 session）

| tag | session SID | keywordGroups | keywordSkills (boost) |
|---|---|---|---|
| 1-CN | ses_0b165993bffea0jeCuVULdX6QK | architecture | brainstorming |
| 1-EN | ses_0b1655aa3ffeRgSUq6osTn07ds | cicd | ci-cd-guardrails,cross-directory-ci |
| 2-CN | ses_0b1651c08ffe8rD1elQ5R18uxm | source-edit | codegraph-first |
| 2-EN | ses_0b164dd76fferFcJSqPh6ncSVz | source-edit | codegraph-first |
| 3-CN | ses_0b1649ee0ffeHfqdf5owl1N83c | source-edit,cicd | codegraph-first,ci-cd-guardrails,cross-directory-ci |
| 3-EN | ses_0b1646050ffexIObDuDvxOK2Iq | architecture | brainstorming |
| 4-CN | ses_0b16421b9ffeE80fEqlwt6xMqh | cicd | ci-cd-guardrails,cross-directory-ci |
| 4-EN | ses_0b163e6f5ffeiGxLSRSyUcosMB | cicd | ci-cd-guardrails,cross-directory-ci |
| 5-CN | ses_0b163a869ffeoup94I4AL6AD1Y | none | none |
| 5-EN | ses_0b16369d9ffe6VcMMNWL0reNCf | none | none |
| 6-CN | ses_0b1632b42ffeHcCwZugidf0syX | cicd | ci-cd-guardrails,cross-directory-ci |
| 6-EN | ses_0b162ecb3ffeetJsjka3i3DrzL | cicd | ci-cd-guardrails,cross-directory-ci |
| 7-CN | ses_0b162ae26ffe5o36UG5gMoGf6D | database,library-dep | cicd-database-seeding,sqlite-bloat-investigation,context7-first |
| 7-EN | ses_0b1626f99ffeHunrj6ccqABuzN | database | cicd-database-seeding,sqlite-bloat-investigation |
| 8-CN | ses_0b1623100ffeeUMomQz3PgY1gr | source-edit,architecture,library-dep | codegraph-first,brainstorming,context7-first |
| 8-EN | ses_0b161f266ffeiqD1maBPrQdtR2 | cicd | ci-cd-guardrails,cross-directory-ci |
| 9-CN | ses_0b161b3d3ffeJbFoqBYHHYN6wN | none | none |
| 9-EN | ses_0b1617542ffeNUgM0RfBYpI85J | none | none |
| 10-CN | ses_0b16136a8ffeAIJ2ZHGDa4Po78 | none | none |
| 10-EN | ses_0b160f817ffe30G80TaATiIbDv | none | none |
| 11-CN | ses_0b160b981ffeALCnwXwsbXsoQx | source-edit | codegraph-first |
| 11-EN | ses_0b1607aedffeDgYCjDFbRxfyUm | source-edit | codegraph-first |
| 12-CN | ses_0b1603c54ffeKN1qqEKISq3lad | none | none |
| 12-EN | ses_0b15ffdbfffeU37ouzqG1y3kR4 | none | none |

判定: 24/24 条均在**真实 serve session** 中产生 `SKILL-SUMMARY-INJECTED` 事件（12 CN + 12 EN），注入机制在 live 环境工作正常；22/24 条 boost 与 in-process runtime-smoke 完全一致，证明 runtime-smoke 证据可靠；问题仍在关键词匹配的「语义正确性」与「双语一致性」（见 Findings），非运行时故障。

## 关键发现 (Findings)

### F1 — 双语不一致 (CN≠EN): 4/12 行
同意图的中文与英文 prompt 触发了**不同**的 skill 组：
- **#1** 澄清需求：CN→`brainstorming`(architecture)，EN→`ci-cd-guardrails`(cicd)。原因：EN 句含 "build" 命中 cicd 组 `/\b(build)\b/i`；而 architecture EN 组 `/\b(plan|design|...)\b/i` 对 "clarify/requirements" 无匹配。
- **#4** dispatch 子任务：CN/EN 均因含 "build" 命中 cicd（见 F2），与意图 dispatch-protocol（base）无关。
- **#7** 数据库迁移：CN 因 "数据库" 含字符 **"库"** 额外命中 library-dep 组（其 CN 模式含 `库`）→ 多注入 `context7-first`；EN 无此问题。
- **#8** 查版本：CN 因含英文 "change"/"breaking change" 命中 source-edit+architecture，又因 "版本" 命中 library-dep → 三技能；EN 因 "version" 命中 cicd → 完全不同组。

### F2 — 英文子串在中文文本中误命中 (substring false-positive)
中文句子里夹带的英文单词被英文 regex 误判：
- "build"（#1 EN、#4 CN/EN）→ cicd
- "change" / "breaking change"（#8 CN）→ source-edit / architecture
- "version"（#8 EN）→ cicd

### F3 — 单字符碰撞: "库" 被 "数据库" 携带命中
library-dep 组 CN 模式 `/(官方文档|依赖|版本|最佳实践|外部框架|API文档|库)/` 含裸 `库`；任何含 "数据库" 的中文 prompt（#7）都会被错误归入 library-dep → 注入 context7-first。

### F4 — 设计意图未落地 (intent gap): #4 / #9 / #10
- **#4** `dispatch-protocol`：是 `AGENT_SKILLS.Orchestrator` 的 **base** skill（始终注入），但**无 keyword 触发**；且 "dispatch" 一词在 `KEYWORD_TRIGGERS` 中**完全无匹配**。
- **#9** `investigation-evidence`：是一个 live skill，但**既不在 AGENT_SKILLS 也不在 KEYWORD_TRIGGERS** → 永远不被关键词注入（"根因"/"调查" 无对应模式）。
- **#10** `context7-first` 意图靠 "API" 触发，但 library-dep 组对裸 "API" 无匹配（需 "API reference"/"api文档"）；故 "API 行为冲突" 不注入任何 boost。

### F5 — 注入机制本身正常
`matchKeywords` → `assessTask` → `writeLog("plugin-skill-summary","INFO",{event:"SKILL-SUMMARY-INJECTED",keywordSkills,keywordGroups})` 链路在 24 条真实 session 全部正确产出日志；问题**仅**在模式集合的语义/双语覆盖，非运行时故障。

### F6 — live 与 in-process 的细微出入（bridge vs cold-start DB fallback）
- **#3-CN** live 多命中 `cicd` 组（in-process 仅 `source-edit`）；**#3-EN** live 命中 `architecture`(brainstorming)（in-process 为 `source-edit`/codegraph-first）。
- 推测根因：`skill-summary` 在 live serve 中每个 transform 都运行；首轮经 `chat.message` 桥捕获正确用户文本，但若桥为空则 `coldStartDbFallback` 从 SDK `opencode.db` 读取最近文本 part——可能带入相邻文本（如 assistant 上文或系统注入）导致额外/不同匹配。in-process `_b1_live.ts` 用 `captureUserMessage(sid,text)` 直接注入精确文本，无 fallback 噪声。
- 影响：live 环境下同源 prompt 的 boost 可能因捕获文本波动而小幅漂移；核心双语不一致结论（F1-F4）不受影响。

## 建议修复方向（非本次 B1 范围，记录待办）
1. **分词/语言感知**：中文用短语词典匹配，英文用单词边界，避免中文里夹带英文子串误命中（F2）。
2. **移除裸 `库`**（F3）：改为 `数据库` 或 `依赖库` 整词，或将 library-dep 的 CN 模式与 database 组解耦。
3. **补齐意图缺口**（F4）：在 `KEYWORD_TRIGGERS` 增加 `dispatch` / `investigation` / 裸 `API` 模式；或明确这些技能仅作 base，不在矩阵中宣称 keyword 触发。
4. **稳定 live 捕获**（F6）：`coldStartDbFallback` 应只取当前用户轮次文本，避免跨轮次/系统文本污染；或要求桥必填、fallback 仅作最后的兜底且标注来源。
5. **双语对齐测试**：将本矩阵 24 条纳入 CI，断言 `CN.boost == EN.boost`，防止回归。

## 当前冻结事实（2026-07-11 交叉审核）
- live Skill 总数 = 18。
- `skill-summary` 为 active system handler，**已在真实 serve (4096) 中验证运行**（live LLM E2E，24/24 命中）。
- 新增能力先进 Skill，不新增自定义 agent prompt（Orchestrator 是唯一实质自定义 agent）。
- B1 矩阵证据等级已从 **runtime smoke** 升级至 **live LLM E2E**（真实 session 走完一轮 LLM，SID 见上表明细）；runtime-smoke 结果被 live 结果交叉验证。
