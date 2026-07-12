# Legacy 角色收敛到 native executor

**为什么**: live code 仍把 9 个旧角色保留在 `.opencode/agents/` 和 `opencode.json.agent` 中，`alias_of` 又不会被 OpenCode runtime 读取，导致设计上“只保留 Orchestrator 自定义 agent”和实际运行态不一致。

**改了什么**:
- `work-one/opencode.json` — active agent 收敛为 `Orchestrator/build/general/plan/explore`，Orchestrator 读取范围改到 `.opencode/legacy/agent-profiles/*.md`
- `work-one/.opencode/service/dispatch/*` — 新增 `agent-target.ts`，`prompt-builder` 写入 native executor marker，`task-before` 改写 `subagent_type`，`marker-consume` 按 prompt hash dequeue，`router` 记录 requested role + native executor
- `work-one/.opencode/service/permission/*` 与 `service/session/config-attest.ts` — 增加 legacy role permission fallback 与 legacy role profile 读取路径
- `work-one/.opencode/legacy/agent-profiles/*.md` / `.opencode/agents/` — 9 个旧角色移入 legacy role profiles，active agents 目录只保留 `Orchestrator.md`
- `work-one/.opencode/scripts/framework-self-test.ts`、`pre-execution-hook.sh`、`service/file-guard/critical-files.ts`、`lib/__tests__/permission-equivalence.test.ts` — 自检、关键文件清单和权限单测切到新布局

**决策**: 没有直接删除旧角色语义，而是保留为 legacy role profile；真实 `Task()` 仍让 native executor 执行，framework 内部继续按 legacy role 做兼容审计。这样既完成物理收敛，也避免 `build/general` 共用时丢失旧角色约束和 dispatch queue 串单。
