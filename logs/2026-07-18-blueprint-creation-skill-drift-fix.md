# 2026-07-18 blueprint-creation skill 漂移修正

## 为什么
交叉审核发现 `.agents/skills/blueprint-creation/SKILL.md` 与现实代码/工作区约定发生 3 处漂移。

## 改了什么（v1.1.0 → v1.1.1，5 处行修改）
1. "ACP session 测试" → "serve API session 测试"（line 20/28/66）：ACP 桥 2026-07-01 已 redesign 为 serve API，工作区共识为清理 ACP 引用。
2. 子系统 12 "外部依赖（禁止 npm）" → "禁止新增 npm 依赖，现有依赖冻结"：work-one `.opencode/package.json` 实际含 2 个 npm 依赖，现行约定是"无新增依赖"。
3. 子系统 12 "≤400行目标" → "≤400行，历史目标待重新校准"：全工作区无其他佐证，按用户裁决保留并标注。

## 决策
- 12 子系统清单、attest 工具族（config/skill/rule_read_attest + read_audit）、`.task_temp/_logs/`、checklist 系统均核实无漂移，未改动。
- blueprints/ 目录 ~7/24 文件不遵守 `blueprint-*` 前缀，属执行层偏差，未改 skill 约定。

## 更新的文档
- `.agents/skills/blueprint-creation/SKILL.md`（修改，v1.1.1）
- 本日志（新建）
