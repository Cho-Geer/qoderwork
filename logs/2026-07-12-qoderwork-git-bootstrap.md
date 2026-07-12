# qoderwork 清理废弃残留并初始化本地 Git

**为什么**: qoderwork 目录存在损坏的 `.git` 残留、误生成空文件、重复报告副本和大量本机运行态/工具状态，先清理高置信废弃项，再建立可用的本地 Git 仓库。

**改了什么**:
- `.gitignore` — 新增根级忽略规则，排除 `.task_temp`、依赖缓存、本机工具镜像和 `Zone.Identifier` 等噪音。
- 根目录残留 — 删除损坏 `.git`、空文件 `-`/`1`/`n`/`**最近更新**` 系列、空目录 `qoderwork/`、空目录 `.codex/`、重复文件 `framework-deprecation-audit-report-2026-07-12.md`。
- `.agents/` / `.trae/` / `.qoder/` — 清除 `__pycache__` 和 Windows `*:Zone.Identifier*` 副产物，保留正文内容。

**决策**: 只删除高置信无价值残留；`.qoder/skills`、`documents/`、`plans/`、`scripts/`、`screenshots/` 等项目资产保留，运行态目录改为通过 `.gitignore` 隔离，而不是直接粗删。
