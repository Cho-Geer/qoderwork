# safe_shell Phase 7 去 shell 化执行器落地

**为什么**: 更新后的 child_process 安全文档要求 `safe_shell` 不再把原始命令字符串交给 shell；blueprint 也把 Phase 7 定义为 P0 缺口，需要落地 verified executable map、`execFile`/`spawn` 路由和复合 shell 语法 fail-closed。

**改了什么**:
- `/home/zhaoge/workspace/opencode/work-one/.opencode/service/file-guard/shell-plan.ts` / `command-executor.ts` — 新增 `VerifiedCommandPlan` 规划与异步执行器，固定绝对可执行文件映射、最小环境、`execFile`/`spawn` 路由和输出/超时/中断控制。
- `/home/zhaoge/workspace/opencode/work-one/.opencode/service/file-guard/shell-guard.ts` / `.opencode/tools/safe_shell.ts` — `safeBashTool` 改为异步执行 verified plan，拒绝 composition/glob/expansion，并把 signal/timedOut/truncated 元数据回传给 tool 输出。
- `/home/zhaoge/workspace/opencode/work-one/.opencode/service/tool-governance/policies/shell-policy.ts` / `.opencode/service/dispatch/tool-scope-paths.ts` / tests — 治理层前移拒绝不可验证 shell 语法，补 `parseShellWriteTargets` re-export 缺口，并新增执行/策略回归测试。

**决策**: 保持现有治理链不引入新的跨层状态传递，先用共享 planner 让 before policy 与最终执行器复用同一套命令约束；复合命令、重定向、通配符和环境展开统一拒绝，不再尝试兼容旧 allowlist 的 shell 习惯。
