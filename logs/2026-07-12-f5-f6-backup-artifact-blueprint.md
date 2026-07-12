# F5 F6 backup artifact blueprint

**为什么**: 用户要求核实 `team-elevation/04-architecture-review.md` 中 F5/F6 是否属实，并输出一份弱模型可安全执行、无分支选项的实施方案。随后又要求进一步区分“现在可并行执行”和“必须串行稍后执行”的步骤，避免与正在执行的 framework-deprecated-content 主线冲突。

**改了什么**:
- `blueprints/blueprint-f5-f6-backup-artifact-remediation.md` — 新增并优化单一路径实施 blueprint，明确 F5 已修复、F6 属实但范围偏窄，并把步骤拆成“现在可并行”“现在不能并行”“当前禁止碰”“串行切换条件”四层边界

**决策**: 不直接让弱模型硬删 `.bak`；先验证 canonical 正本存在，再把 stray backup 迁入受控 quarantine 路径。由于当前 deprecated-content 主线正在修改 `project.config.json`、`install-hooks.ts`、`prompt-builder.ts`、`tool-tracker.ts`、`pre-execution-gate.ts` 等核心文件，因此把 F5/F6 方案拆成并行区与串行区，入口层文件（`.gitignore`、`hook-layers.ts`、`ci-semantic-validator.ts`）延后到主线收口后再动。
