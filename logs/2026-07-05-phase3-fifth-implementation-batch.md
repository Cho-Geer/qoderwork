# Phase 3 第五批脚本与命令收敛

**为什么**: 前几批已经清掉 active runtime 和主要配置上的重模式依赖，这一批继续清理还会直接影响执行入口或模型工作流心智的 shell/doctor/command 层。

**改了什么**:
- `opencode/work-one/.opencode/scripts/pre-execution-hook.sh` — 去掉 `ENFORCEMENT_MODE` 覆盖；存在 `enforcement_policy` 时直接走 `strict` compat；Stage 1 失败统一 blocking
- `opencode/work-one/.opencode/scripts/framework-doctor.ts` — `Dispatch-policy consistency` 不再绑定 locked-mode 旧约束，改为 single-policy 兼容说明
- `opencode/work-one/.opencode/commands/search-knowledge.md` — UC7KS 文案从 `strict/locked` 改为 `knowledge-cache-miss` rule-driven；知识补全优先 native `Task`
- `qoderwork/implementation-plans/phase3-implementation-plan.md` — 记录第五批实施进度

**决策**: 本批优先改真正还会被执行或高频阅读的入口脚本和命令，而不是继续扩散到所有 legacy 文档。这样能继续压缩旧模式心智的残留，同时保持改动面可控。
