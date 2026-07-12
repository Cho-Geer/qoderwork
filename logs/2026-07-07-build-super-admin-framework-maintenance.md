# Build/Super-Admin 框架维护授权重构实施

**目标**: 将框架维护授权从"一文件一次 Super-Admin 派遣"改为"任务级 grant + 子 Agent 自声明计划 + 多写预算"，同时保留 CodeGraph 与路径策略约束。

**改了什么**:
- `.opencode/service/dispatch/framework-maintenance-policy.ts` — 新增 policy 模块，读取 `project.config.json` 的 `dispatch_privilege.framework_maintenance`，提供默认/阻断路径、写入预算硬上限。
- `.opencode/service/dispatch/privilege.ts` — `createGrant` 无 `allowed_paths` 时使用默认策略；新增 `max_writes`/`writes_used`/`recordGrantWrite()`/`completeGrant()`；`hasGrant` 拒绝预算耗尽。
- `.opencode/service/dispatch/framework-maintenance-plan.ts` — 新增 plan 生命周期，校验 planned paths 必须在 grant 策略内，同一 session+grant 只能有一个 active plan。
- `.opencode/tools/framework_maintenance_plan.ts` / `framework_maintenance_complete.ts` — 新增计划声明/完成工具。
- `.opencode/tools/safe_framework_edit.ts` — 改为多写预算模型：policy 路径检查 → active grant → active plan → 写文件 → `recordGrantWrite()`。
- `.opencode/plugins/session.ts` — 新增 `resolveChildDispatchKey`，同一 parent 存在多个 pending/running dispatch 时 fail-closed 并记录 `GRANT-BIND-AMBIGUOUS`。
- `.opencode/plugins/before-dispatcher.ts`、`plugin-handlers/before/behavioral-path-guard.ts`、`service/dispatch/tool-scope-match.ts` — 将 `safe_framework_edit` 接入 before-chain、CodeGraph、scope path 识别。
- `.opencode/tools/dispatch_subagent.ts` 文案更新，移除 "one-time" 和 allowed_paths 必填误导。
- `opencode.json` — 给 `build` 增加 `framework_maintenance_plan`、`framework_maintenance_complete` 权限。
- 新增测试: `.opencode/service/dispatch/__tests__/framework-maintenance.test.ts`（13 项通过）、`tool-scope.test.ts`（2 项通过）。

**决策**:
- 不删除 `consumeGrant()`，保持旧消费逻辑兼容；`safe_framework_edit` 改用 `recordGrantWrite()`，预算耗尽自动消费。
- `hard_max_writes` 从配置读取，超出时 `resolveGrantMaxWrites` 截断，防止弱模型请求过大预算。
- `framework_maintenance_plan` 拒绝覆盖已有 active plan，避免弱模型误操作。

**验证**:
- `bun test ./.opencode/service/dispatch/__tests__/framework-maintenance.test.ts` → 13/13 通过。
- `bun test ./.opencode/service/dispatch/__tests__/tool-scope.test.ts` → 2/2 通过。
- 清理 Bun 缓存、重启 `opencode serve`（端口 4096）；`opencode run "hello" --agent Orchestrator --auto` 正常加载。
