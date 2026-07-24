# BOOTSTRAP-WAIVER: Phase Progression 治理框架自修改

- **授权**: Human reviewer（本次会话明确接受 bootstrap waiver）
- **日期**: 2026-07-24
- **原因**: 正在构建的 phase-progression validator 尚不存在；要求其先通过自身尚未实现的 plan/progression gate 会形成 bootstrap 循环。
- **豁免范围**: 仅豁免本蓝图 Phase 1 的正式 implementation plan；不豁免文件范围、代码审查、测试、证据、回滚和 fail-closed 要求。
- **允许文件**: `AGENTS.md`、deterministic planning skill/template/validator/test、`.agents/skills/deterministic-implementation-planning/scripts/phase-progression.ts`、其测试，以及本 waiver 日志。
- **禁止事项**: 不修改 work-one；不执行 plan-audit-archiver sync；不迁移或改写 P0-2 状态；不新增 `--force` 或手工 ACCEPT 入口。
- **失效条件**: 任何超出允许文件的写入、测试/证据缺失、或将 component 结果声称为 runtime/live PASS，立即停止并报告。
- **后续收口**: 新 validator 通过独立正/反夹具后，必须为后续治理改动恢复正常 provenance plan 与 Freeze Gate。
