# Tool governance protected-read 回归修复

**为什么**: 审核 roadmap/plan 与当前代码时发现 `tool-governance/path-policy.ts` 的只读命令豁免正则误写成控制字符，导致 `safe_shell cat .opencode/service/**` 被 `BEHAVIORAL-PATH-GUARD` 错挡，和文档中“只读 orchestration 允许”设计不一致。

**改了什么**:
- `work-one/.opencode/service/tool-governance/policies/path-policy.ts` — 把只读命令正则从错误的 `\x08` 控制字符改为 `\b` 单词边界，并补注释说明要与 `behavioral-path-guard` 保持一致。
- `work-one/.opencode/service/tool-governance/__tests__/path-policy.test.ts` — 新增 `safe_shell cat .opencode/service/repo/classify.ts` 回归用例，确认 protected path 的只读命令返回 allow。
- `qoderwork/blueprints/blueprint-tool-governance-mvc-refactor.md`、`blueprints/blueprint-opencode-framework-simplification-roadmap.md`、`plans/opencode-framework-simplification-roadmap/00-overview.md`、`plans/opencode-framework-simplification-roadmap/04-phase3-enforcement-slimming.md` — 同步 30/30 policy 测试、protected-read 已修复、剩余只差 live LLM E2E。

**决策**: 选择修代码而不是继续把文档写成“待确认”，因为 `behavioral-path-guard.ts` 本来就明确豁免只读 `safe_shell`；`path-policy.ts` 的 deny 是实现回归，不是设计分歧。
