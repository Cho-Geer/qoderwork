# Phase 3 第十三批 compat 尾巴收口

**为什么**: active hook 与 compat shim 的返回结构已经不一致，`hook-commit-msg` 仍在读旧 `downgraded/configMode/envMode` 字段；同时自检和 UC7KS remediation 还残留 `preamble Step 0d`、`dispatch_subagent first` 叙事。

**改了什么**:
- `/home/zhaoge/workspace/opencode/work-one/.opencode/service/gate/{store-types.ts,enforcement.ts}` — 统一 `EnforcementModeWithSource` 为 `mode/source/envOverride` compat 结构
- `/home/zhaoge/workspace/opencode/work-one/.opencode/hooks/lib/hook-commit-msg.ts` — 改成 single-policy notice + `policy` 审计字段，不再读旧 compat 字段
- `/home/zhaoge/workspace/opencode/work-one/.opencode/service/knowledge/enforcement.ts` — UC7KS 无 taskId remediation 改为 native `Task` first，legacy wrapper second
- `/home/zhaoge/workspace/opencode/work-one/.opencode/scripts/framework-self-test.ts` — Check 63 改名为 `preflight-lite interaction protocol`，去掉 `preamble Step 0d` 命名残余
- `/home/zhaoge/workspace/qoderwork/implementation-plans/phase3-implementation-plan.md` — 记录第十三批实施状态和验证口径

**决策**: 这一批只收 active compat 尾巴和自检命名，不扩散到历史 test/doctor 全仓清理；优先消除真实热路径字段错位和弱模型仍可能读到的旧叙事。
