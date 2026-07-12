# 将本地工具目录纳入 Git 版本管理

**为什么**: 当前这些目录不再视为纯本机状态，而是希望作为 qoderwork 项目资产长期追踪：`.agents/`、`.arts/`、`.codex/`、`.trae/`、`.workbuddy/`、`.qoder/settings.local.json`。

**改了什么**:
- `.gitignore` — 取消忽略 `.agents/`、`.arts/`、`.codex/`、`.trae/`、`.workbuddy/`、`.qoder/settings.local.json`。
- `.codex/.gitkeep` — 新增占位文件，让空的 `.codex/` 目录可被 Git 追踪。

**决策**: 将这些目录/文件统一视为仓库内可追踪配置与资料，而不是一次性本机缓存；仍继续忽略 `.codeartsdoer/`、`.opencode/state/`、`node_modules/`、`.task_temp/` 等运行态噪音。
