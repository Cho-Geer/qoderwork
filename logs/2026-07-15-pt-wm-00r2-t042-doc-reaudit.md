# PT-WM-00R2 T042 runner 修复后二次文档复核

**为什么**: 用户提供 `2026-07-15-pt-wm-00r2-t042-runner-fix.md` 后，需要确认该日志、修复后的 runner、再生成 artifact 与当前 `skill-policy.ts` 一致，并清除蓝图/测试式样书里残留的“先修 T042 runner”过期表述。

**改了什么**:
- `blueprints/blueprint-permission-template-driven-enforcement.md` — 版本升到 v1.6.1；§1.8 改为当前状态表述，确认 T042 runner 已修正但 verdict 仍 `BLOCKED`，并更新后续真跑顺序。
- `e2e/permission-template-enforcement-test-spec.md` — 版本升到 v1.5.1；§7.1 与 §8.3 去除过期的“先修 runner”步骤，改为“已修正 dry-run supporting evidence，仍不得外推为 PASS”。

**决策**: 只更新文档状态，不修改 work-one 代码，也不改变任何 test ID 裁决。T042 runner 修复只解除 runner 自身 `INVALID`，不解除 `BLOCK-PT-02/03`，后续执行仍以 T-PT-048/049/050 真实前置为先。
