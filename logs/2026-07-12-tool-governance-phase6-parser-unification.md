# Tool governance Phase 6 parser unification

**为什么**: `safe_shell` 的 active before 链仍未收口，`path-validate`、`tool-scope-paths`、`codegraph` 各自维护解析逻辑，导致 `gh --repo` 误判修完后，`codegraph` 仍会先于 `repo-policy` 抛 `CODEGRAPH-ENFORCE`。

**改了什么**:
- `work-one/.opencode/service/tool-governance/shell-targets.ts` — 新增共享 `safe_shell` 解析入口，统一本地路径提取、write target 解析、evidence target 提取
- `work-one/.opencode/plugin-handlers/before/path-validate.ts`、`work-one/.opencode/service/dispatch/tool-scope-paths.ts`、`work-one/.opencode/plugin-handlers/before/codegraph.ts` — 改为复用 `shell-targets`，并让 `codegraph` 对 repo/gh shell 命令显式 defer
- `work-one/.opencode/plugins/before-dispatcher.ts`、`work-one/.opencode/project.config.json` — 将 `tool-governance` 前移到 `path-validate` / `codegraph` 之前，固定统一首裁决顺序
- `work-one/.opencode/plugin-handlers/before/__tests__/*`、`work-one/.opencode/service/tool-governance/__tests__/shell-targets.test.ts` — 补齐 repo slug、gh api、git add、cp、node script 等回归用例

**决策**: Phase 6 先做“parser 单源化 + before 顺序收口”，不继续在旧 handler 上补第四套私有解析；`repo-policy` 继续做 repo/gh 首裁决，`codegraph` 收缩回本地源码 evidence gate。
