# Phase 3 第二批 active path 收敛

**为什么**: 第一批已经去掉最重的身份式写前误杀，这一批继续把 active path 上剩余的 mode 依赖、旧 preamble 语义和弱模型质量下限控制转成轻量技能注入加审计。

**改了什么**:
- `opencode/work-one/.opencode/plugin-handlers/before/codegraph.ts` — 不再依赖 `getEnforcementMode()`，直接按 `source-edit-without-codegraph` 规则阻断
- `opencode/work-one/.opencode/service/knowledge/enforcement.ts` — UC7KS 写前语义改成 `hard_block / audit_only`，去掉 `mode` 传递
- `opencode/work-one/.opencode/service/gate/scope-validate.ts` — 不再为 UC7KS 传递旧 mode
- `opencode/work-one/.opencode/service/session/skill-attest.ts` — required skill attestation 优先 `SKILL.md`，降低上下文负担
- `opencode/work-one/.opencode/service/dispatch/prompt-builder.ts` — 去掉 `P0 Step 0e` 老门禁措辞，并修复模板字符串中的反引号语法问题
- `opencode/work-one/.opencode/plugin-handlers/system/skill-summary.ts` — 增加风险、freshness、Scout、TodoWrite 软治理注入和结构化事件
- `opencode/work-one/.opencode/plugin-handlers/after/quality-contract.ts` — 增加 `todo_write_observed` / `todo_missing_for_nontrivial` / freshness evidence 观测
- `opencode/work-one/.opencode/skills/preflight-lite/SKILL.md` — 明确 Scout 走 native Task，不复活 legacy preamble/dispatch wrapper
- `qoderwork/implementation-plans/phase3-implementation-plan.md` — 记录第二批实施进度

**决策**: 先改 active runtime，再留 legacy/config 收尾。这样能先让真实执行路径符合新方案，同时避免一次性触碰旧自检脚本、历史 schema 和大块配置带来的回归风险。
