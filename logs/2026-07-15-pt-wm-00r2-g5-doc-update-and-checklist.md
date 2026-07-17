# PT-WM-00R2 G5 文档状态二次更新 + checklist 补齐

**为什么**: G2-G4 12 个脚本已全部落盘，但 blueprint v1.5.0 和 test-spec v1.4.0 的账本未反映该事实；同时 g3-t051 和 g4-adv009 缺失 checklist.md，evidence 完整性有缺口。

**改了什么**:
- `blueprints/blueprint-permission-template-driven-enforcement.md` — 新增 §1.7 "G2-G4 测试脚本落地"，记录 12 脚本 4551 行 DRY_RUN=true 落盘、G1 两个不同硬门发现、opencode 4097 question 无 token 状态、BLOCK-PT-02/03 保持
- `e2e/permission-template-enforcement-test-spec.md` — §7.1 账本后追加 G2-G4 脚本落盘补充说明，明确 READY (not executed) 不改变任何 test ID 裁决
- `e2e-evidence/.../g3-t051/t051-checklist.md` — 新建，含 10 live steps + 4 oracles + 三重前置条件 + required evidence
- `e2e-evidence/.../g4-adv009/adv009-checklist.md` — 新建，含 12 mutations + 20 rounds schedule + 2 oracles + required evidence

**决策**: 仅记录脚本落盘事实，不改变任何 test ID 执行状态；不选择修复策略；忠实记录 opencode question 无 guidance token 的状态。§7.1 原有裁决行保持不变。

**未决项**:
- G6 Final Gate 决策（Accept / Rework / Stop）pending
- opencode 4097 question `que_f613576b9001D3ig6qA8KxMCMU` 仍挂起（用户忘记了 token 值，非无 token）
- 真跑前置条件未满足（reviewer 隔离 serve + H2 授权 + HARD_GATE=1）
