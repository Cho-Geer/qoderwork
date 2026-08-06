# 2026-08-05 — AGENTS.md 模型映射硬编码调查 + 双重审核 + 优化思路

> 状态：**REWORK 已裁决，优化思路待执行**（本文件为调查结论 + 双重审核结果 + 修正后优化方向的落盘）
> 触发：用户指出 `~/.zcode/AGENTS.md` 大模型映射"写死了"，但实际可自由设置；要求调查并给出优化思路。
> 审核链：M3(general-purpose) 独立审核 ×2 失败（TURN_CANCELLED）→ GLM-5.2(high-precision) 独立复审 Self-Fail + 10 条漏点 → 主会话 Final Gate **REWORK**（独立复核 9 条成立 / 1 条驳回）。

---

## 1. 问题背景

`~/.zcode/AGENTS.md` 与 `~/.zcode/skills/task-execution-framework/SKILL.md` 中硬编码了 `subagent_type → 大模型` 的映射，声称"已验证"。但运行时实测显示该映射与实际不符，且用户（真实配置所有者）可以自由设置模型。

## 2. 调查结论（主会话原始版）

### 结论 A：硬编码映射存在
- `~/.zcode/AGENTS.md` L47-48：`general-purpose → MiniMax-M3`、`Explore → MiniMax-M2.7`、`high-precision → GLM-5.2`
- `~/.zcode/skills/task-execution-framework/SKILL.md` L182-186：同样映射，标注"已验证 2026-07-31"

### 结论 B：运行时与硬编码映射脱节
- 2026-08-03 probe：Explore → MiniMax-M3、general-purpose → deepseek-v4-flash、high-precision → k3
- 2026-08-05 probe + 两次 M3 审核会话：general-purpose 实跑 deepseek-v4-flash（@ 7195f2ff provider）
- 即：**general-purpose 实际运行时不是 MiniMax-M3**，与 AGENTS.md 不符

### 结论 C：实际生效机制
- `~/.zcode/agents/high-precision.md` L5 frontmatter `model: "custom:7195f2ff-...:glm-5.2"` 生效
- `~/.zcode/v2/config.json` 多 provider 多模型，用户可自由选择

## 3. GLM-5.2 独立复审结果（10 条漏点）

GLM-5.2 独立运行 E1-E4 验证命令 + 额外核查（memory 目录、全文 model 引用、harness log 31 个 spawned 事件关联、文件 mtime），Self-Fail。核心修正：

1. **AGENTS.md L46 虚假断言**：`由 subagent_type 决定模型` 与运行时实测矛盾（同 subagent_type 跑多模型）
2. **AGENTS.md L49 路由强制硬编码**：`M3执行+M3独立审核+GLM-5.2独立复审`，D1 原方案未涵盖
3. **SKILL.md §3.7 整段路由逻辑硬编码**（L188-236，15+ 行）：仅改 L182-186 是表面化修复
4. **L182 `已验证 2026-07-31` 虚假断言**：文件 mtime = 2026-07-31，08-03/08-05 probe 均矛盾
5. **high-precision.md L3 description / L19 body 硬编码模型名**（`MiniMax-M3 (general-purpose)`、`running on GLM-5.2`）
6. **结论 B cherry-pick**：实测是混沌多对多（general-purpose 同日跑 3 种模型；high-precision 跑 2-5 种），非干净 1:1
7. **结论 C 过度断言**：frontmatter 不是可靠指示器（high-precision 实跑含非 glm-5.2 模型）
8. **AGENTS.md L42 优先级协调**：`本规则优先于 task-execution-framework 全文`，D1/D2 必须协调
9. **Provider 名称不精确**：无 `api.deepseek.com`，实际是 `7195f2ff-93d8-4717-80a6-b845791d949f`
10. **probe-subagent-runtime SKILL.md 已存在**：D4 应引用 canonical 来源，避免重复造轮子

## 4. 主会话 Final Gate 独立复核

| GLM-5.2 断言 | 主会话独立验证 | 裁决 |
|---|---|---|
| AGENTS.md L46-49 硬编码（含 L46/L49） | ✅ 实读 | 成立 |
| SKILL.md §3.7 整段硬编码 | ✅ 实读 | 成立 |
| L182 虚假"已验证" | ✅ probe 矛盾 | 成立 |
| high-precision.md L3/L19 硬编码 | ✅ 实读 | 成立 |
| 运行时混沌多对多 | ✅ 独立关联：general-purpose→3 模型、high-precision→2-4 模型 | 成立 |
| frontmatter 不可靠 | ✅ | 成立 |
| D1/D2/D3 覆盖面不足 | ✅ | 成立 |
| **"~/.zcode/memory 不存在，D4 前提错误"** | ❌ **误报**：ZCode memory 在 `~/.zcode/cli/memories/projects/check-plan-*/memory/`，其中确有 `feedback/no-subagent-model-routing-in-memory.md`（2026-08-04 用户指令） | **驳回** |

**Final Gate: REWORK**（详见 §6 修正后的优化思路）。

## 5. 运行时实测证据（Final Gate 后主会话复核）

| subagent_type | 08-05 实测 model 集合（harness log 独立关联） |
|---|---|
| Explore | `85bbc6d1-.../MiniMax-M3`（**非** M2.7） |
| general-purpose | `7195f2ff-.../deepseek-v4-flash`、`7195f2ff-.../minimax-m3`、`e168e6c5-.../deepseek-v4-flash-0731` |
| high-precision | `7195f2ff-.../deepseek-v4-flash`、`7195f2ff-.../glm-5.2`、`builtin:bigmodel-coding-plan/GLM-5.2`、`e168e6c5-.../deepseek-v4-flash-0731` |

→ **运行时是混沌多对多关系**，subagent_type 不决定性决定 model；frontmatter 是配置入口但不保证生效。

## 6. 优化思路（修正后，REWORK 版）

### 方向 D1 — AGENTS.md 模型映射区重构（L45-49 整体）
- 移除 L47-48 硬编码映射表（`general-purpose → MiniMax-M3` 等）
- 修正 L46 虚假断言：「派遣子 agent 时一律不传 `model` 参数（由 `subagent_type` 决定模型）」→ 改为「派遣子 agent 时默认不传 `model` 参数，模型由 `subagent_type` 定义 + 用户配置（`~/.zcode/agents/*.md` frontmatter / `~/.zcode/v2/config.json`）共同决定；运行时以 probe 实测为准」
- 修正 L49 路由强制：`M3执行+M3独立审核+GLM-5.2独立复审` → 按角色描述（执行 / 独立审核 / 独立复审），不绑定具体模型名；模型选择以运行时实证为准
- 保留 L42 优先级声明，但明确「优先级规则与模型无耦合」

### 方向 D2 — task-execution-framework SKILL.md §3.7 重构（L182-236 整体，非仅 L182-186）
- 撤回 L182 虚假断言「已验证 2026-07-31」→ 改为「配置可随用户环境变化，运行时以 probe 实证为准」
- 移除 L183-185 硬编码映射表
- 重构 §3.7 路由逻辑主体（L188-236 的 15+ 行）：`Explore / general-purpose / high-precision` 保留为**能力角色**（低/中/高推理深度），不再绑定具体模型名；`M3 返工`语义改为「general-purpose 返工」或按 subagent_type 记录
- 判断 2B（`M3 历史返工`）改为按 subagent_type 记返工，避免模型名语义错乱

### 方向 D3 — high-precision.md 自身文本清理（L3/L19）
- L3 description：移除 `MiniMax-M3 (general-purpose)` 对照表述 → 改为能力描述（「高精度推理，用于超过 general-purpose 单次可靠能力的任务」）
- L19 body：移除 `running on GLM-5.2` → 改为「高精度推理 agent，底层模型由用户配置决定」
- frontmatter `model:` 字段**保留**（用户配置入口），但文档明示「实际运行时模型须以 probe 实证为准，frontmatter 不保证生效」

### 方向 D4 — 方法论引用与 memory 治理
- 引用 canonical 来源：优化文档明确指向 `~/.zcode/skills/probe-subagent-runtime/SKILL.md`（已存在，含「禁止仅依赖 self-report」「禁止写 memory」规则），不另起炉灶
- 遵守既有 user 指令：`~/.zcode/cli/memories/projects/check-plan-*/memory/feedback/no-subagent-model-routing-in-memory.md`（2026-08-04）——禁止固化 model→subagent_type 映射，只记「如何实证 model」的纯方法论
- AGENTS.md/SKILL.md 中只保留能力角色描述 + probe 方法论指针，不写死模型名

## 7. 执行建议（后续实施时的顺序与验证）

1. **先 probe 后改文档**：实施前运行 `probe-subagent-runtime` 确认当前运行时模型集合，作为重构基线
2. **D2 先行**：先重构 task-execution-framework §3.7（路由逻辑主体），再改 AGENTS.md（D1），避免两处同时改造成不一致
3. **验证**：改完后 grep 确认 AGENTS.md / SKILL.md / high-precision.md 无 `MiniMax-M3`、`MiniMax-M2.7`、`GLM-5.2` 模型名硬编码残留（`general-purpose`/`Explore`/`high-precision` 角色名保留）
4. **回归**：短 task 派遣 3 类 subagent 各 1 次，确认角色能力描述与实际行为一致

## 8. 已知未决项

- M3 (general-purpose) 独立审核两次失败（TURN_CANCELLED，实跑 deepseek-v4-flash @ 7195f2ff）——审核链以 GLM-5.2 单层 + 主会话独立复核完成，M3 层无产出
- 本文件为纯调查/优化报告，未修改任何配置或文档（保持只调查状态）