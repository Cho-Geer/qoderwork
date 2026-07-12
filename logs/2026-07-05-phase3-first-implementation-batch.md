# Phase 3 第一批热路径收敛已开始落地

**为什么**: 需要把 Phase 3 从方案推进到代码，优先移除最容易误阻断原生 agent / 原生 Task 的身份式硬约束，同时保留真正的安全硬边界。

**改了什么**:
- `qoderwork/implementation-plans/phase3-implementation-plan.md` — 增加“当前实施进度”，记录第一批已落地范围和剩余项
- `opencode/work-one/.opencode/service/gate/scope-validate.ts` — 删除 per-agent 写前硬阻断，保留 backup-bypass 等行为型 hard block
- `opencode/work-one/.opencode/service/permission/reader.ts` — 未声明 permission 的 agent 改为 neutral legacy profile
- `opencode/work-one/.opencode/service/session/config-attest.ts` — agent 配置文件不存在时改为 audit-only pass
- `opencode/work-one/.opencode/service/dispatch/marker-consume.ts` — 原生 Task 缺少 `DISPATCH_TOKEN` 改为审计兼容

**决策**: 先改热路径、后清理 mode 和 prompt。这样能先消除最常见的误杀与阻塞，同时不触碰 `behavioral-path-guard`、protected path、backup-bypass 等真正的硬安全边界。
