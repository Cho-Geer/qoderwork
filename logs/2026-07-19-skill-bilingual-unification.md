# 2026-07-19 — Skill 双语统一为形态B + 字数限制 400→500

## 为什么

调查发现项目内 24 个 skill 的 description 存在 4 种形态（A 独立 description_zh 字段、B 中英 / 分隔、C 纯英文/中文主体），标准不统一。其中形态A的 `description_zh` 字段经 `grep` 全盘验证为 OpenCode SDK 零消费的死字段。用户决策统一到形态B（首句中英 `/` 分隔），并同步将 skill-diagnosis-optimization 的 description 最佳区间上限从 400 提升至 500。

## 改了什么

- **形态A 8 个 skill**：删除 `description_zh` 死字段，description 首句改为 `<英文首句> / <中文首句>`（复用原 description_zh 首句）。
- **形态B-中英混合 6 个 skill**：首句重排为严格 `/` 分隔格式（英文摘要在前）。
- **形态C-纯英文 9 个 skill**：首句追加 ` / <中文翻译>`。
- **形态B-已达标 1 个 skill**（opencode-framework-dev）：不动。
- **skill-diagnosis-optimization 字数限制**：5 处 `400`→`500`；1 处 `>500 过长`→`>600 过长`（保持区间自洽）；`DESC_MAX_CHARS` 500→600（与评分规则一致）。
- **新建 plan-audit-archiver skill**：审核 plans 实施进度并归档到 `audits/<plan-name>/`，含 templates/audit-report-template.md。
- **新建 logs-governance skill**：维护 logs/INDEX.md 与 logs/archive/ 归档，含 templates/logs-index-template.md。

## 决策

- 选形态B而非形态A：运行时（@opencode-ai SDK）零消费 description_zh，加了等于死字段；形态B 的 description 被运行时消费且 skill-diagnosis 双语维度可判 ✅。
- DESC_MAX_CHARS 同步从 500→600：避免与新区间（200-500 最佳、500-600 可接受、>600 过长）矛盾。
- 两个新 skill 合并 logs 索引+归档为单一 logs-governance：避免 skill 总数膨胀，共享扫描逻辑。

## 更新了什么文档

- `AGENTS.md` §3 目录结构：补充 `audits/` 与 `logs/` 注释
- `AGENTS.md` §3.1 主要模块说明：新增 `audits/` 模块说明，扩展 `logs/` 说明
- `AGENTS.md` §11.4 日志索引与归档：新增小节
- `.agents/skills/` 下 24 个 skill 的 SKILL.md frontmatter
- `.agents/skills/plan-audit-archiver/SKILL.md`（新建）+ `templates/audit-report-template.md`
- `.agents/skills/logs-governance/SKILL.md`（新建）+ `templates/logs-index-template.md`
- `logs/2026-07-19-skill-bilingual-unification.md`（本日志）
