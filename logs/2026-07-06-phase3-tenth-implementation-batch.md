# Phase 3 第十批 active runtime 与 self-test 对齐

**为什么**: 前几批已经把大部分热路径切到 rule disposition，但 active gate/runtime 仍残留 mode 语义，自检也还在要求废弃的 `legacy/subagent-preamble.md`，导致代码真相、技能设计和 plan 状态继续分叉。

**改了什么**:
- `/home/zhaoge/workspace/opencode/work-one/.opencode/service/permission/reader.ts` — 配置不可读改按 `permission-config-unreadable` 规则处理，去掉 mode 文案
- `/home/zhaoge/workspace/opencode/work-one/.opencode/service/gate/mcp-check.ts` — gate check 存储与返回改为 compat 标记，不再依赖 locked bypass 语义
- `/home/zhaoge/workspace/opencode/work-one/.opencode/service/gate/mcp-complete.ts` — ESLint/TSC/artifact 分别按专用 rule 处置，artifact retry 固定策略
- `/home/zhaoge/workspace/opencode/work-one/.opencode/plugin-handlers/before/config-guard.ts` — 改为 `dangerous-shell-command` rule-driven block
- `/home/zhaoge/workspace/opencode/work-one/.opencode/service/gate/checklist-validate.ts` — checklist incomplete 的非阻断路径改为 audit-only 文案
- `/home/zhaoge/workspace/opencode/work-one/.opencode/skills/preflight-lite/SKILL.md` — 增加 investigation / `## Logs Checked` / config_read_attest / blocked todo / native Task 指导
- `/home/zhaoge/workspace/opencode/work-one/.opencode/scripts/framework-self-test.ts` — Check 34/47/63 改检 active skill/service，不再强依赖 legacy preamble
- `/home/zhaoge/workspace/qoderwork/implementation-plans/phase3-implementation-plan.md` — 同步第十批实施状态和 self-test 漂移现状

**决策**: 不再继续把废弃 preamble 当权威约束源，而是把 `preflight-lite` 升级为 active control skill，再让 self-test 回头校验 active skill 与 active service；legacy 文件保留兼容，但不再主导验收结论。
