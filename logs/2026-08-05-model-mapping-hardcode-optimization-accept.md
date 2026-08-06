# 2026-08-05 — AGENTS.md / SKILL.md / high-precision.md 模型硬编码优化（Accept）

## 为什么
handoff `2026-08-05-model-mapping-hardcode-optimization.md` §6 D1-D4 落盘：移除 `subagent_type → model` 硬编码映射，改写为「能力角色 + 配置入口 + probe 实证」表述。根因：3 文件硬编码 `MiniMax-M3/M2.7/GLM-5.2` 与运行时多对多实测矛盾，且 user-explicit 禁止固化 model→subagent_type 映射（2026-08-04 memory）。

## 改了什么
- `~/.zcode/AGENTS.md` L45-49 → L45-50：D1 区域整体重构，移除映射表；L46 虚假断言「由 subagent_type 决定模型」改为配置+probe 口径；L49 路由强制改为角色表述（执行/独立审核/独立复审）；新增「优先级与模型无耦合」bullet
- `~/.zcode/skills/task-execution-framework/SKILL.md` §3.7 L182-238：D2 区域（前置事实 + 判断 1/2/3 + §3.7.1 memory 格式）15+ 行整体改写；L182「已验证 2026-07-31」撤回；判断 2B 「M3 返工」→「general-purpose 返工」；memory 模板 `name: subagent-rework-<task-type>` 改为按 subagent_type 维度记录
- `~/.zcode/agents/high-precision.md` L3 + L19 + bare `M3` 别名 L30/L31/L34/L35/L39(×2)/L52：D3 区域清理；frontmatter `model:` L5 byte-identical 保留（用户配置入口）；新增 `probe-subagent-runtime` 引用

## 决策
执行链：M3 (general-purpose) 执行 + GLM-5.2 (high-precision) 独立复审 + 主会话 Final Gate 验收（audit-separation 三层分离）。GLM-5.2 仅 1 条 MINOR 漏点（M3 自报 §3.7 行号 L182-236 vs 实际 L182-238，含 closing fence，文件内容无缺陷）。主会话独立 grep 抽查（3 文件硬编码模型名 + bare M3/M2.7 别名）全 0 hits。

## 更新了什么文档
- `~/.zcode/AGENTS.md`（D1）
- `~/.zcode/skills/task-execution-framework/SKILL.md`（D2）
- `~/.zcode/agents/high-precision.md`（D3）
- `logs/2026-08-05-model-mapping-hardcode-optimization-accept.md`（本文件）