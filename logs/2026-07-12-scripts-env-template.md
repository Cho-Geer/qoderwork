# 为 `scripts/.env` 增加远程仓库模板

**为什么**: 希望把远程仓库配置以模板化方式放进 `scripts/.env`，同时保持真实 secrets 只存在本地、可提交仓库中只保留无敏感信息的模板文件。

**改了什么**:
- `scripts/.env.example` — 新增可提交模板，包含 API key 占位符和 Git remote 模板变量。
- `scripts/.env` — 追加非敏感的 Git remote 配置块，保留本地 secrets 文件继续由 `.gitignore` 隔离。

**决策**: 采用“双文件”方式：仓库提交 `.env.example`，本地使用 `scripts/.env`；模板中只放占位符，不放任何真实认证信息。
