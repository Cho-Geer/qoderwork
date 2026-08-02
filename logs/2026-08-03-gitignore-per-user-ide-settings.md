# 2026-08-03: ignore per-user IDE local settings

## 为什么
用户列 11 个工作区根目录问能否 ignore。复审确认 9 个未 ignore 目录大多含已 tracked
协作内容,不能一刀切;唯一可清理的是 `.qoder/settings.local.json` 与
`.codebuddy/settings.local.json`(per-user 权限白名单 / additionalDirectories)。

## 改了什么
- commit `ff0633b`: `git rm --cached` 两个 settings.local.json(工作区文件保留)
- `.gitignore` +2 行:`/.qoder/settings.local.json`、`/.codebuddy/settings.local.json`,
  前缀 `/` 锁定根目录;不误伤子目录或 `.codegraph/.gitignore` 自管理

## 决策
不 ignore: `.arts .codex .kimi-code .qoder(除上) .trae .vscode .workbuddy
.codebuddy(除上)` — 含项目共享 spec/memory/extensions.json/skills 软链。`.codegraph/`
保持现状(子 `.gitignore` 已 self-managed;根 `/codegraph/` 模式是错的,不匹配 `.codegraph/`)。

更新: `logs/2026-08-03-gitignore-per-user-ide-settings.md`(本文件)
