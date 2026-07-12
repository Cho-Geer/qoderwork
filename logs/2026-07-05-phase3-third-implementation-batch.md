# Phase 3 第三批配置迁移与 TodoWrite 细化

**为什么**: 第二批已经把 active runtime 的主要 mode 分支和技能注入路径拉回新方案，这一批继续把运行时仍会接触到的配置字段、知识 attestation 模式依赖和 TodoWrite 软治理细化掉。

**改了什么**:
- `opencode/work-one/.opencode/service/file-guard/tsc-gate-config.ts` — `tsc_gate_mode` 迁移为 `tsc_gate_strategy`，保留兼容回退
- `opencode/work-one/.opencode/service/knowledge/cache-attest.ts` — `mandatory_knowledge` 改为 `enabled + enforced_by_rule`，去掉 `ENFORCEMENT_MODE` 依赖
- `opencode/work-one/.opencode/project.config.json` — 新增 `enforcement_policy` 描述，`mandatory_knowledge` 改为单策略配置，`tsc_gate_strategy` 替代 `tsc_gate_mode`
- `opencode/work-one/opencode.json` — 删除 `compliance-gate` MCP 的 `ENFORCEMENT_MODE` 注入；修正 legacy preamble deny 路径
- `opencode/work-one/.opencode/service/gate/checklist-phase.ts` — remediation 文案改为 native Task 兼容
- `opencode/work-one/.opencode/plugin-handlers/after/quality-contract.ts` — 增加 `todo_write_invalid_status`、`todo_write_mismatch`、`todo_stale_after_tools`
- `qoderwork/implementation-plans/phase3-implementation-plan.md` — 记录第三批实施进度

**决策**: 不一次性删除所有 legacy mode 词汇，而是先消除当前运行时会真正踩到的 mode 配置读取和死引用。这样可以继续推进 single-policy，同时避免把历史 doctor/CI/测试脚本一次性全部打断。
