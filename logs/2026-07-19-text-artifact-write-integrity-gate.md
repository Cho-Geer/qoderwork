# 2026-07-19 文本产物写入完整性闸门

## Why
一次日志文件曾以空文件形式存在，工具成功回执未能证明内容已落盘。

## What
- `AGENTS.md`：新增强制的串行文本写入、非空/行数/内容断言及 fail-closed 规则。
- `.agents/skills/pre-flight-enforcement/SKILL.md`：升级为 v2.3，要求 Pre-Flight、执行约束和 Post-Execution Audit 都记录文本产物完整性证据。
- 移除该 skill 不被标准校验器接受的 `version` 前置字段；版本记录保留在正文。

## Decision
- 工具回执不是写入完成证据；每个非空文本产物必须通过 `test -s`、`wc -l` 和内容断言。

## Docs updated
- `AGENTS.md`
- `.agents/skills/pre-flight-enforcement/SKILL.md`
- 新增本日志。

## Evidence
- `quick_validate.py .agents/skills/pre-flight-enforcement` → Skill is valid.
