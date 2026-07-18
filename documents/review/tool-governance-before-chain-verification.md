# 验证报告：tool-governance 在真实 before 链上对 `safe_shell gh issue create` 的命中顺序

**日期**: 2026-07-13
**结论**: ✅ 已确认。在真实 active `tool.execute.before` 链上，`safe_shell gh issue create --repo ...` **先命中 `tool-governance`**，且它是首个（也是唯一）拒绝该命令的 handler。

---

## 1. 权威顺序来源（active before chain 定义）

`.opencode/project.config.json` 的 `plugin_execution_order.before`（与 `before-dispatcher.ts` 的 `DEFAULT_ORDER` 完全一致；`getExecutionOrder` 在缺少覆盖时回退到 DEFAULT_ORDER，此处配置文件存在且精确匹配）：

```
0 gate-call-context
1 guidance-bridge
2 task
3 permission-safety
4 behavioral-path-guard
5 scope
6 tool-governance   ← 第 7 位
7 path-validate
8 codegraph
9 skill-policy
10 dispatch-signal
```

调度循环（`before-dispatcher.ts:92-109`）串行执行 `order` 中的 handler，**不对单个 handler 的 throw 做 catch** → 首个 throw 即终止整条链（短路语义）。

## 2. 真实执行序列（实证）

通过 esbuild 打包**真实** `before-dispatcher.ts`（与 serve 同款 bundler，绕开 `bun run` 的循环 re-export 加载失败），再以 `bun run` 执行，输入：

```ts
{ tool: "safe_shell", sessionID: "tg-live-verify",
  args: { command: "gh issue create --repo microsoft/vscode --title test --body body" } }
```

结果：
- 控制台：`LIVE-RESULT: THREW` / `LIVE-ERROR: [REPO-OP] Direct gh remote_write operations are blocked. Use safe_repo_* first-class tools instead.`
- `plugin-before-dispatcher-runtime.log` 的 HANDLER-START 序列：
  ```
  1 guidance-bridge
  2 permission-safety
  3 behavioral-path-guard
  4 scope
  5 tool-governance   ← 之后链短路，path-validate/codegraph/... 未执行
  ```
- `audit.jsonl`：`governance_block, ruleId=REPO-OP, layer=repo-policy, outcome=deny`
- `plugin-tool-governance-handler-runtime.log`：`HANDLER-BLOCK | [REPO-OP] ...`

错误文案 `[REPO-OP]` 仅由 `tool-governance`（→ `repo-policy.ts`）产生；若前置 handler 先抛，文案应为 `[GUIDANCE-GATE]` / `[HOOK-CONFIG-GUARD]` / `[GIT-GUARD]` / `[BACKUP-BYPASS]` / `[BEHAVIORAL-PATH-GUARD]`。实际命中 `[REPO-OP]` 证明 tool-governance 是首个 denier。

> 安全说明：本次 live 验证**未创建真实 GitHub issue**——tool-governance 在工具实际执行前即拒绝，gh 进程从未启动。

## 3. 前置 handler 不拦截的代码依据

| 前置 handler | 行为 | 对 `gh issue create` 的结论 |
|---|---|---|
| `guidance-bridge` → `anti-bypass` | 仅当 session 的 guidance gate 激活时拦截非 question 工具 | 干净 session 放行 |
| `permission-safety` → `config-guard` | 仅拦 Git hook bypass 模式（`--no-verify` 等） | 不匹配 → 放行 |
| `permission-safety` → `git-guard` | 仅拦 `git commit --no-verify` / `core.hooksPath` 等 hook bypass | 不匹配 → 放行 |
| `behavioral-path-guard` | PROTECTED_PATHS 正则匹配命令中的受保护路径 | 正则不匹配 `gh issue create --repo ...` → 放行（记 `behavioral_path_allowed`） |
| `scope` → `validateWriteScope` | safe_shell 为 modify tool，但命令无本地 `filePath`，`scopeResult.paths` 为空 | 放行（`exit (pass) no file path`） |

## 4. 关键发现：为何现有测试只停留在 unit/component 层

- 现有测试 `plugin-handlers/before/__tests__/tool-governance-handler.test.ts` **直接调用 `handle()`**，绕过真实 dispatcher 与排序，仅能证明“tool-governance 单独会拒绝 gh issue create”，**无法证明**（a）真实链上的排序；（b）无前置 handler 先拦截。
- **根因**：真实 `before-dispatcher.ts` 无法用 `bun run` 独立加载——模块图存在循环 re-export（`service/dispatch/tool-scope-paths.ts` ↔ `service/tool-governance/shell-targets.ts` 的 `parseShellWriteTargets`），bun 原生 ESM 链接失败：
  `SyntaxError: export 'parseShellWriteTargets' not found in '../service/dispatch/tool-scope-paths'`
  仅 serve 的打包器（esbuild/tsup）能解析该循环。这正解释了为何测试只能以 unit/component 粒度存在、缺少 dispatcher 级集成测试。

## 5. 建议

1. 新增 **dispatcher 级集成测试**：用与 serve 相同的打包器加载 `before-dispatcher`，断言 `safe_shell gh issue create` 的首个 `HANDLER-BLOCK` 来自 `tool-governance`、且 `path-validate`/`codegraph` 未被执行。需先解决模块图加载问题（打破 `parseShellWriteTargets` 的循环 re-export，或让该测试走打包器）。
2. 或在 CI 中增加对 `project.config.json` `before` 顺序的断言，固化“`tool-governance` 位于 `path-validate`/`codegraph` 之前”。
