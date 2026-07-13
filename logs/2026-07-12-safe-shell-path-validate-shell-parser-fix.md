# Safe-shell path-validate shell parser fix

**为什么**: `safe_shell` 的 `path-validate` 对命令字符串直接扫斜杠，导致 `gh issue create --repo microsoft/vscode`、`gh api repos/...`、JSON body、`/dev/null` 等被误识别为本地文件路径，Orchestrator 在 live session 中反复卡死在 `safe_shell` 重试。

**改了什么**:
- `work-one/.opencode/plugin-handlers/before/path-validate.ts` — 用 statement/argv 级 shell 解析替换 `safe_shell` 正则提取；`git/gh` 改走 repo classifier，本地路径参数按命令语义识别，并支持 `cd` 上下文、重定向与 path-bearing flags。
- `work-one/.opencode/plugin-handlers/before/__tests__/path-validate.test.ts` — 新增 `gh --repo`/`gh api`/JSON body/`/dev/null`/`cd && relative path`/`node -e` 等回归用例，并修正一条原本不合理的 symlink 断言。

**决策**: 不做 `microsoft/vscode` 这类 repo slug 特判，也不放宽所有带 `/` 的 token；选择把 `path-validate` 升级为命令语义解析，保证“远程 repo 标识不再误判、本地越界路径仍然严格阻断”这两个目标同时成立。
