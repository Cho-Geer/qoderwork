# Phase 3 第八批：prompt 与 dispatch 兼容语义收敛

**为什么**: pre-commit 收敛后，运行期仍有一批用户可见提示把 native Task 排除在外，继续强调 `dispatch_subagent`、`LOCKED mode`、`advisory mode`、`Step 0d/0e` 这类旧框架语义，会拖慢 simplification roadmap 的落地。

**改了什么**:
- `/home/zhaoge/workspace/opencode/work-one/.opencode/service/dispatch/prompt-builder.ts` — dispatch prompt 明确 native `Task` first，`dispatch_subagent` 仅 legacy compat。
- `/home/zhaoge/workspace/opencode/work-one/.opencode/scripts/pre-execution-gate.ts` — KC dispatch token、Super-Admin、UC7KS 相关提示改为 active policy / native Task 兼容表述。
- `/home/zhaoge/workspace/opencode/work-one/.opencode/service/dispatch/dispatch-validate.ts` — PLAN-FIRST、route mismatch、audit-only 日志去除 `dispatch_subagent to` 和 `advisory/strict/locked` 语义。
- `/home/zhaoge/workspace/opencode/work-one/.opencode/service/dispatch/router.ts` — dispatch auth 报错从 `LOCKED/STRICT` 改为 `DISPATCH-AUTH`，`dispatch-sa-repair` 改按 rule block 输出。
- `/home/zhaoge/workspace/opencode/work-one/.opencode/service/session/config-attest.ts` — native `Task` / legacy wrapper 兼容提示与注释更新。
- `/home/zhaoge/workspace/opencode/work-one/.opencode/service/knowledge/cache-check.ts` — UC7KS banner 改为 `POLICY CHECK`，不再输出 `LOCKED mode` 风格文本。
- `/home/zhaoge/workspace/qoderwork/implementation-plans/phase3-implementation-plan.md` — 补记第八批实施与验证。

**决策**: 这一批只改“仍会进入当前执行链、并且会影响模型行为或用户理解”的消息与兼容语义，不去全面重写 legacy 文档、历史 self-test 和已弃用 handler，避免和现有大更新发生不必要冲突。
