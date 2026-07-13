---
name: skill-diagnosis-optimization
description: "Skill 体系诊断与自动优化。五阶段流程：诊断（评分+重叠检测+总量评估）→ 合并同类项（控制在 15 个以内）→ ACP 引用清理（替换为 serve API curl 命令）→ 自动修复（空描述/过长/过短/缺触发词/缺双语/.bak 残留）→ 报告（保存到 skill-audit-report.md + 飞书通知）。Trigger: skill 诊断, skill 审计, skill 优化, skill 合并, ACP 清理, skill health check, 技能健康检查, 技能合并. Not for: 创建单个 skill（用 skill-creator）, 编辑单个 skill 内容, 查询 skill 列表（直接用 qw_query）."
version: 1.0.0
agent_created: true
---

# Skill 诊断与优化

对 QoderWork 项目已安装 skill 体系进行系统性诊断、合并、ACP 引用清理与自动修复，输出审计报告并通知飞书。

## 前置条件

- QoderWork Connector 可用（`mcp__qw-builtin__qw_query` / `mcp__qw-builtin__qw_action`）
- 飞书 Connector 已连接（用于第五阶段通知）
- WSL 可访问 `/home/zhaoge/workspace/qoderwork/` 路径
- 用户级 skill 目录：`~/.workbuddy/skills/`
- 项目级 skill 目录：`/home/zhaoge/workspace/qoderwork/.workbuddy/skills/`

## 关键参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `USER_SKILLS_DIR` | `~/.workbuddy/skills/` | 用户级 skill 目录 |
| `PROJECT_SKILLS_DIR` | `/home/zhaoge/workspace/qoderwork/.workbuddy/skills/` | 项目级 skill 目录 |
| `REPORT_PATH` | `/home/zhaoge/workspace/qoderwork/skill-audit-report.md` | 报告输出路径 |
| `MAX_SKILLS` | `15` | skill 总数最佳区间上限 |
| `MIN_SKILLS` | `10` | skill 总数最佳区间下限 |
| `DESC_MIN_CHARS` | `150` | description 最短长度 |
| `DESC_MAX_CHARS` | `500` | description 最长长度 |
| `DESC_BEST_MIN` | `200` | description 最佳区间下限 |
| `DESC_BEST_MAX` | `400` | description 最佳区间上限 |
| `BODY_MAX_LINES` | `600` | SKILL.md 正文行数上限 |

## 五阶段流程

```
Phase 1: 诊断 → Phase 2: 合并 → Phase 3: ACP 清理 → Phase 4: 自动修复 → Phase 5: 报告
```

**顺序约束**：必须按上述顺序执行。Phase 2 合并后才能清理已合并 skill 的 ACP 引用；Phase 3 清理后才能修复 description（避免重复修改）；Phase 4 修复后才能生成最终报告。

---

## Phase 1: 诊断 `[ANALYSIS]`

> **注意**：本阶段全部是静态文件读取和评分，不产生运行态证据。诊断结果是基于代码分析的判断，不是运行态验证。

### Step 1: 获取全部已安装 skill 列表

```javascript
// 通过 QoderWork Connector 查询
mcp__qw-builtin__qw_query({ key: "qoderwork.settings.skills" })
```

记录返回的 skill 名称列表和启用状态。

### Step 2: 读取每个 skill 的 SKILL.md

对 `USER_SKILLS_DIR` 和 `PROJECT_SKILLS_DIR` 下的每个 skill 目录：

1. 读取 `SKILL.md` 文件
2. 解析 YAML frontmatter，提取 `name` 和 `description`
3. 统计正文行数（frontmatter 之后的内容）
4. 检查目录下是否有 `.bak` 残留文件、空目录、`reference.md` 等附属文件

**跳过规则**：以 `.merged-` 开头的目录是合并备份，跳过不诊断。

### Step 3: 多维度评分

对每个 skill 检查以下 7 个维度：

| 维度 | 检查方法 | 评分 |
|------|---------|------|
| **description 长度** | `description.length` | <150 chars → ❌ 过短；>500 chars → ❌ 过长；200-400 → ✅ 最佳；150-200 或 400-500 → ⚠️ 可接受 |
| **触发词** | 检查 description 是否含 "Trigger:"、"Use when"、"When to use"、"触发词"、"适用于" | 有 → ✅；无 → ❌ |
| **负面边界** | 检查 description 是否含 "Not for"、"Do NOT use"、"不适用于"、"不适用" | 有 → ✅；无 → ❌ |
| **双语覆盖** | 检查 description 是否同时含中文和英文 | 双语 → ✅；单语 → ⚠️ |
| **正文结构** | 检查正文是否有编号步骤（`1.` `2.`）或分节（`##`） | 有 → ✅；无 → ❌ |
| **空描述/空目录** | description 为空或目录下无 SKILL.md | 空 → ❌ 严重 |
| **.bak 残留** | 目录下存在 `*.bak` 文件 | 有 → ❌ |

### Step 3b: 认知缺陷防护评分

对每个 skill 检查以下 4 个维度：

| 维度 | 检查方法 | 评分 |
|------|---------|------|
| **步骤类型标注** | 检查正文是否有 `[ANALYSIS]`/`[VERIFICATION]`/`[OBSERVATION]` 标注 | 有验证步骤但无标注 -> ❌；有标注 -> ✅；无验证步骤 -> ⏭️ 不适用 |
| **证据行要求** | 检查 `[VERIFICATION]` 步骤后是否有 `Verified-by:` 证据行要求 | 有验证步骤但无证据行 -> ❌；有证据行 -> ✅；无验证步骤 -> ⏭️ 不适用 |
| **合理化检测** | 检查是否有「如果你发现自己在想 X--停下来，这是跳步信号」模式 | 有验证步骤但无合理化检测 -> ⚠️；有 -> ✅；无验证步骤 -> ⏭️ 不适用 |
| **认知说明** | 检查是否有「源码分析回答意图，运行态验证回答事实」类认知说明 | 有 ANALYSIS->VERIFICATION 流程但无认知说明 -> ⚠️；有 -> ✅；无此流程 -> ⏭️ 不适用 |

**适用判断**：纯操作型技能（如 docx/pdf/pptx/xlsx）无验证步骤，4 个维度均标为 ⏭️ 不适用，不影响总评。

**检测方法**：用 Grep 工具搜索以下关键词：
- 步骤类型标注：`\[ANALYSIS\]|\[VERIFICATION\]|\[OBSERVATION\]`
- 证据行：`Verified-by:`
- 合理化检测：`合理化检测|跳步信号`
- 认知说明：`源码分析|运行态验证|意图.*事实`

### Step 4: 重叠检测

两两对比所有 skill 的 description，识别触发场景重叠的 skill 组。

**检测方法**：
1. 提取每个 description 的关键词（去掉停用词后的名词/动词）
2. 计算两个 description 的 Jaccard 相似度（关键词交集/并集）
3. 相似度 > 0.3 → 标记为"重叠组"

**重叠组识别**：将所有相似度 > 0.3 的 skill 对聚合为重叠组（传递性闭包）。

### Step 5: 总量评估

- 计算当前 skill 总数（不含 `.merged-` 备份）
- 计算 description 总 token 开销（粗略估算：1 char ≈ 0.3 token）
- 与最佳区间 `MIN_SKILLS-MAX_SKILLS`（10-15）对比

---

## Phase 2: 合并同类项

**触发条件**：仅当 skill 总数 > `MAX_SKILLS`（15）时执行。≤ 15 则跳过本阶段。

### Step 6: 识别可合并组

根据 Phase 1 Step 4 的重叠检测结果，识别可合并的 skill 组（通常 3-4 个重叠 skill 合并为 1 个）。

**合并优先级**：
1. 同一领域的高重叠组（如 "opencode-framework-debug" + "opencode-dev-tools" + "opencode-data-diagnostics"）
2. 跨领域但功能互补的组（如 "log-first-debugging" + "vm-error-recovery"）
3. 低重叠但可整合的组

### Step 7: 执行合并

对每个可合并组：

1. **创建新 SKILL.md**：
   - `name`: 综合性名称（如 `opencode-framework-dev`）
   - `description`: 合并所有原 skill 的核心触发词，控制在 200-400 chars
   - 正文：按章节组织，每个原 skill 内容作为一节（`## 原 skill A`、`## 原 skill B`）
   - 保留所有原 skill 的完整知识

2. **备份原 skill**：
   - 将原 skill 目录重命名为 `.merged-{name}`（备份而非删除）
   - 例：`opencode-framework-debug/` → `.merged-opencode-framework-debug/`

3. **验证新 skill**：
   - 确认新 SKILL.md 的 frontmatter 可正确解析
   - 确认 description 长度在 200-400 chars
   - 确认正文行数未超过 `BODY_MAX_LINES`（600）

### Step 8: 迭代

如果合并后仍 > 15 个，继续识别次优先合并组，重复 Step 7，直到达标或无更多可合并组。

---

## Phase 3: ACP 引用清理

ACP bridge MCP server 已弃用，当前直连 serve API（`localhost:4096`）。扫描并清理所有 skill 中残留的 ACP bridge 引用。

### Step 9: 全文搜索 ACP 关键词

对所有 skill 目录（含 `.merged-` 备份）下的 `SKILL.md` 和 `reference.md` 执行以下搜索：

**搜索关键词**（用 Grep 工具）：
```
acp_start|acp_send|acp_stop|acp_list|acp_poll_events|acp_events|acp_answer|acp_check|
ACP bridge|ACP 模式|ACP stdio|mcp__acp-bridge|
通过 ACP bridge 启动|跑 ACP 测试|ACP 流式实测|ACP 返回状态
```

### Step 10: 执行替换

对每处匹配按以下规则替换：

| 原文 | 替换为 |
|------|--------|
| `acp_start(agent="X", initial_prompt="Y")` | `curl -X POST localhost:4096/session -d '{"title":"X","agent":"X"}'`（创建 session） |
| `acp_send(session_id="SID", prompt="MSG")` | `curl -X POST localhost:4096/session/SID/prompt_async -d '{"parts":[{"type":"text","text":"MSG"}]}'` |
| `acp_stop(session_id="SID")` | `curl -X POST localhost:4096/session/SID/abort` |
| `acp_list()` | `curl -s localhost:4096/session` |
| `acp_poll_events(session_id="SID")` | `curl -s localhost:4096/question + tail /tmp/sse-events.jsonl \| grep SID` |
| `acp_events(reader_id, limit)` | `tail -N /tmp/sse-events.jsonl` |
| `acp_answer(question_id, answer)` | `curl -X POST localhost:4096/question/QID/reply -d '{"answers":[["option-label"]]}'` |
| `ACP bridge` | `serve API` |
| `ACP 模式` | `serve API 模式` |
| `ACP stdio` | `serve API HTTP` |
| `mcp__acp-bridge__xxx` | 对应的 curl 命令 |
| `通过 ACP bridge 启动` | `通过 serve API 创建 session` |
| `跑 ACP 测试` | `通过 serve API 实测` |
| `ACP 流式实测` | `serve API 实测` |
| `ACP 返回状态` | `serve API 返回内容` |

### Step 11: 保留不替换的内容

以下内容**不替换**：

- `acp_notify`：这是 OpenCode 的真实事件类型名（notify-server MCP 工具），不是 bridge 特有
- SSE daemon 路径中的 `acp-bridge` 目录名（如果实际路径未改，保留）
- description 中 "Not for: ACP bridge 功能开发" 可保留（表示不适用的边界）
- `acp-bridge-test-suite.md` 等历史文档名（文档标题保留）

### Step 12: 检查 description 触发词

检查每个 skill 的 description 中是否包含已不存在的工具名（`acp_start`/`acp_send` 等）作为触发词。如有，替换为对应的 serve API 操作名（如 `curl /session`、`SSE 事件读取`）。

---

## Phase 4: 全部自动修复

对所有诊断出的问题执行自动修复。

### Step 13-21: 按问题类型修复

| 问题 | 修复方法 |
|------|---------|
| **空描述** (Step 13) | 根据 SKILL.md 正文内容生成完整 description，含四要素：WHAT（做什么）+ WHEN（何时用）+ TRIGGERS（触发词）+ NEGATIVE（不适用场景） |
| **description >500 chars** (Step 14) | 压缩到 200-400 chars，优先保留：触发词 > 负面边界 > WHAT > WHEN |
| **description <150 chars** (Step 15) | 扩展 description，补充 WHEN 场景和触发词。从正文中提取关键操作作为触发词 |
| **缺少触发词** (Step 16) | 根据正文内容提取关键词，追加到 description 的 "Trigger:" 部分 |
| **缺少负面边界** (Step 17) | 根据 skill 用途推断不适用场景，追加 "Not for:" 部分 |
| **缺少双语** (Step 18) | 根据现有 description 语言补充对应语言描述。中文 description 补充英文摘要，英文 description 补充中文摘要 |
| **空目录** (Step 19) | 删除该目录（无 SKILL.md 的空目录无用） |
| **.bak 残留文件** (Step 20) | 删除所有 `*.bak` 文件 |
| **正文 >600 行** (Step 21) | 将详细内容抽取到 `reference.md`，正文保留核心步骤和流程指引。在正文末尾添加 "详细参考见 [reference.md](./reference.md)" |

### 修复顺序

1. 先删除空目录和 .bak 文件（Step 19-20）
2. 再修复 description 问题（Step 13-18）
3. 最后处理正文过长（Step 21）
4. 最后处理认知缺陷防护（Step 21b）

### Step 21b: 认知缺陷防护修复

对 Phase 1 Step 3b 检测出的问题执行修复：

| 问题 | 修复方法 |
|------|---------|
| **验证步骤无类型标注** | 找到含「验证」「测试」「确认」「verify」关键词的步骤标题，追加 ` \`[VERIFICATION]\`` 标注；找到含「分析」「读取」「检查配置」关键词的步骤，追加 ` \`[ANALYSIS]\`` 标注 |
| **验证步骤无证据行** | 在每个 `[VERIFICATION]` 步骤的说明后添加 `> 执行后记录 \`Verified-by: <命令> -> <关键返回>\`` |
| **验证步骤无合理化检测** | 在每个 `[VERIFICATION]` 步骤前添加 `> **合理化检测**：如果你发现自己在想「<推断常见跳步理由>」--停下来，这是跳步信号。必须实际执行。` |
| **ANALYSIS->VERIFICATION 流程无认知说明** | 在 ANALYSIS 步骤和 VERIFICATION 步骤之间添加 `> **注意**：源码分析回答「代码意图是什么」，运行态验证回答「运行态实际是什么」。两者可能不一致。` |

**跳过条件**：纯操作型技能（4 个维度均为 ⏭️ 不适用）跳过本步骤。

---

## Phase 5: 报告

### Step 22: 生成报告

> **注意**：报告中的数据必须来自实际执行结果，不是自报。每个声称必须有对应的命令输出作为证据。

报告格式：

```markdown
# Skill Audit Report — YYYY-MM-DD

## 1. 诊断结果

### 1.1 总量评估
- 当前 skill 总数: X（最佳区间: 10-15）
- description 总 token 开销: ~X tokens
- 与最佳区间距离: [达标 / 超出 X 个 / 不足 X 个]

### 1.2 各 skill 评分

| # | Skill 名称 | 描述长度 | 触发词 | 负面边界 | 双语 | 正文结构 | .bak | 总评 |
|---|-----------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 1 | skill-a | ✅ 320 | ✅ | ✅ | ✅ | ✅ | ✅ | 健康 |
| 2 | skill-b | ⚠️ 120 | ❌ | ❌ | ⚠️ | ✅ | ✅ | 需修复 |
| 3 | skill-c | ❌ 580 | ✅ | ✅ | ❌ | ✅ | ❌ | 需修复 |

### 1.3 重叠检测
- 检测到 X 组重叠：
  - 组 1: skill-a, skill-b（相似度 0.45）
  - 组 2: skill-c, skill-d, skill-e（相似度 0.38）

## 2. 合并操作

### 2.1 合并前后对比
- 合并前: X 个 skill
- 合并后: Y 个 skill
- token 开销变化: X tokens → Y tokens（节省 Z%）

### 2.2 合并详情

| 合并组 | 原 skill 列表 | 新 skill 名称 | 原 description 数 | 新 description |
|--------|--------------|--------------|:---:|------|
| 1 | a, b, c | new-a | 3 | [合并后 description] |

## 3. ACP 清理结果

| Skill 名称 | 匹配数 | 替换数 | 关键替换示例 |
|-----------|:---:|:---:|------|
| skill-a | 5 | 5 | `acp_start(...)` → `curl -X POST localhost:4096/session ...` |
| skill-b | 0 | 0 | 无 ACP 引用 |

## 4. 修复结果

| Skill 名称 | 问题 | 修复前 | 修复后 |
|-----------|------|--------|--------|
| skill-b | description 过短 | "做 X"（20 chars） | "做 X。Trigger: x, y. Not for: z."（180 chars） |
| skill-c | .bak 残留 | 存在 index.ts.bak | 已删除 |

### 4.1 认知缺陷防护修复结果

| Skill 名称 | 步骤类型标注 | 证据行 | 合理化检测 | 认知说明 |
|-----------|:---:|:---:|:---:|:---:|
| skill-a | ✅ 已有 | ✅ 已有 | ✅ 已有 | ✅ 已有 |
| skill-b | ✅ 已添加 | ✅ 已添加 | ⚠️ 不适用 | ⚠️ 不适用 |
| skill-c | ⏭️ 纯操作型 | ⏭️ | ⏭️ | ⏭️ |

## 5. 健康指标

| 指标 | 修复前 | 修复后 | 最佳区间 |
|------|:---:|:---:|:---:|
| skill 总数 | X | Y | 10-15 |
| description 总 token | ~X | ~Y | - |
| ACP 残留数 | X | 0 | 0 |
| 空描述数 | X | 0 | 0 |
| .bak 残留数 | X | 0 | 0 |
| 认知缺陷防护缺失数 | X | 0 | 0 |
| description 过短数 | X | 0 | 0 |
| description 过长数 | X | 0 | 0 |
```

### Step 23: 保存报告

将报告保存到 `REPORT_PATH`（默认 `/home/zhaoge/workspace/qoderwork/skill-audit-report.md`），覆盖写入。

```bash
# 使用 Write 工具直接写入
Write({ file_path: "/home/zhaoge/workspace/qoderwork/skill-audit-report.md", content: <报告内容> })
```

### Step 24: 飞书通知

将报告摘要发送到飞书。摘要内容：

```
📊 Skill Audit Report — YYYY-MM-DD

总量: X → Y（最佳区间 10-15）
ACP 残留: X → 0
修复问题: X 项
合并: X 组 → Y 个新 skill

详细报告: /home/zhaoge/workspace/qoderwork/skill-audit-report.md
```

**发送方式**：使用飞书 Connector（`mcp__feishu__send_message` 或对应 MCP 工具）。如果飞书 Connector 未连接，在报告中记录"飞书通知失败，Connector 未连接"，不阻塞流程。

---

## 执行约束

1. **顺序锁定**：五阶段必须按顺序执行，不跳阶段
2. **备份优先**：合并时用 `.merged-` 重命名，不直接删除
3. **保留知识**：合并后的 SKILL.md 必须包含所有原 skill 的完整知识
4. **ACP 例外**：`acp_notify` 不替换（真实事件类型名）
5. **报告必出**：无论是否有问题，Phase 5 报告必须生成
6. **飞书非阻塞**：飞书通知失败不阻塞流程

## 常见陷阱

1. **误替换 acp_notify**：`acp_notify` 是 notify-server MCP 工具，不是 ACP bridge 工具，不要替换
2. **合并丢失触发词**：合并后的 description 必须包含所有原 skill 的核心触发词，否则触发率下降
3. **description 过度压缩**：压缩时优先保留触发词和负面边界，不要只保留 WHAT
4. **正文抽取丢失上下文**：抽取到 reference.md 时，正文必须保留足够的流程指引，不能只剩目录
5. **.merged- 目录被诊断**：Phase 1 诊断时跳过 `.merged-` 开头的目录（是备份不是活跃 skill）
6. **飞书消息过长**：飞书通知只发摘要，不发完整报告（完整报告在文件中）

## 相关 skill

- `skill-creator`：创建单个新 skill 的标准流程
- `pre-flight-enforcement`：本 skill 执行时建议配合使用，约束五阶段顺序执行

## 验证清单 `[VERIFICATION]`

> **注意**：以下每项验证必须基于实际命令输出，不是自检 checkbox。每项必须附 `Verified-by:` 证据行。
> **合理化检测**：如果你发现自己在想「我刚才修过这些文件，肯定没问题」--停下来，这是跳步信号。必须实际运行验证命令。

执行完成后，验证以下项目：

- [ ] 所有 skill 的 description 长度在 150-500 chars 之间
  - `Verified-by: 实际 grep/wc 输出证明每个 description 的字符数`
- [ ] 所有 skill 的 description 含触发词和负面边界
  - `Verified-by: 实际 grep 输出证明 Trigger/Not for 关键词存在`
- [ ] skill 总数 ≤ 15（或已无可合并组）
  - `Verified-by: 实际 ls/qw_query 输出的 skill 计数`
- [ ] 所有 SKILL.md 中无 ACP bridge 引用（`acp_notify` 除外）
  - `Verified-by: 实际 grep 输出证明 ACP 关键词匹配数 = 0`
- [ ] 无 `.bak` 残留文件
  - `Verified-by: 实际 find 输出证明无 *.bak 文件`
- [ ] 无空 skill 目录
  - `Verified-by: 实际 find 输出证明每个 skill 目录都有 SKILL.md`
- [ ] 报告已保存到 `REPORT_PATH`
  - `Verified-by: 实际 ls -la 输出证明文件存在`
- [ ] 飞书通知已发送（或记录失败原因）
  - `Verified-by: 飞书 API 返回或失败日志`
- [ ] 所有含验证步骤的 skill 有 `[VERIFICATION]`/`[ANALYSIS]` 标注
  - `Verified-by: 实际 grep '\[VERIFICATION\]|\[ANALYSIS\]' 输出证明标注存在`
- [ ] 所有 `[VERIFICATION]` 步骤有 `Verified-by:` 证据行要求
  - `Verified-by: 实际 grep 'Verified-by:' 输出证明证据行存在`
- [ ] 所有含验证步骤的 skill 有合理化检测提示
  - `Verified-by: 实际 grep '合理化检测\|跳步信号' 输出`
- [ ] 所有含 ANALYSIS->VERIFICATION 流程的 skill 有认知说明
  - `Verified-by: 实际 grep '源码分析\|运行态验证\|意图' 输出`
