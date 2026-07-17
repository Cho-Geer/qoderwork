# PT-WM-00R2 T-PT-042 runner allowlist 修正 + dry-run 重跑

**为什么**: G5 审核（2026-07-15）发现 `_b_pt_wm_00r2_g2_t042.ts` 的未认证固定 allowlist 错误列入 `list`/`skill_read_state`、遗漏 `config_read_attest`/`rule_read_attest`，runner artifact 标为 INVALID；测试式样书 §8.3 第一步要求先校正并重新生成 dry-run artifact。

**改了什么**:
- `scripts/_b_pt_wm_00r2_g2_t042.ts` — 头部注释（§13-tool matrix 8 allowlist 行）与 `TOOL_MATRIX` 中：移除 `list`、`skill_read_state` 两个 allowlist 条目，补入 `config_read_attest`、`rule_read_attest`；allowlist 仍恰好 8 项、矩阵仍 13 项。
- `e2e-evidence/L3/permission-template-enforcement/rework-pt-wm-00r2/g2-t042/t042-evidence.json` + `t042-checklist.md` — 经 `bun` 默认 `DRY_RUN=true` 重跑重新生成，artifact 标记 `dryRun:true`，allowlist 与源码 `skill-policy.ts` 的 `PRE_ATTEST_ALLOWLIST` 一致。
- `blueprints/blueprint-permission-template-driven-enforcement.md` §1.8 + `e2e/permission-template-enforcement-test-spec.md` §7.1 G5 注 — 追加"runner 已修正"说明，明确 runner 不再 INVALID、但 T-PT-042 执行裁决仍为 BLOCKED。

**决策**: 权威集合取自 work-one 源码 `.opencode/plugin-handlers/before/skill-policy.ts` 第 20–32 行 `PRE_ATTEST_ALLOWLIST`（read/glob/grep/question/skill/config_read_attest/skill_read_attest/rule_read_attest），而非仅信蓝图重述——避免把 runner 改成与真实门控不符的集合。dry-run 不真发请求、不改变任何 test ID 裁决；真跑仍需 reviewer 启动隔离 serve（`FRAMEWORK_SKILL_READ_HARD_GATE=1`）方可执行。
