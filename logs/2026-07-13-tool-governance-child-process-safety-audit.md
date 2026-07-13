# Tool governance 子进程安全契约审计

**为什么**: 两篇 child_process 参考文档暴露出治理 blueprint 只统一了解析与裁决，未约束最终执行器；当前 `shell-guard.ts` 仍直接使用 `execSync(command)`，存在 shell 解释和资源边界风险。

**改了什么**:
- `blueprints/blueprint-tool-governance-mvc-refactor.md` — 升级到 v2.7.0，删除多方案选择，新增固定的 `VerifiedCommandPlan`、去 shell 化 Phase 7、验证项、风险与确定性回滚步骤。
- `documents/review/exec-execFile-spawn.md` — 重写为 execFile/spawn 固定路由与共同安全约束。
- `documents/review/execFile-usage.md` — 重写为 executable/argv/cwd/env、资源限制和 fail-closed 调用契约。
- `documents/INDEX.md` — 同步两篇 review 文档的摘要与实际行数。

**决策**: `safe_shell` 不再允许原始字符串进入子进程 API；单个已建模短命令固定使用异步 execFile，长输出固定使用 spawn，复合 shell 语法固定拒绝并迁移到一等工具或固定 hash 的受审脚本。
