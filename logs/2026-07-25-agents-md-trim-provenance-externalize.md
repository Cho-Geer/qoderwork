# 2026-07-25 AGENTS.md 瘦身与 §15 provenance 规则外移

## 为什么
AGENTS.md 达 33,467 B，超 32 KB 推荐上限触发告警。实测 §15（P-01~P-07）占 22.8%，且仅 plan 实施/审计场景触发，属典型可外移内容。

## 决策
- §15 全文迁至 `.agents/skills/plan-audit-archiver/provenance-rules.md`（唯一正本；该 skill 本已持有 P-rules 全部工具链 capture-state/validate-audit/scope-lock 模板）。用户否决 RULES.md 目标：其靠 §5 每会话强读，移入后净节省为 0 且破坏「输出格式契约」定位。
- AGENTS.md §15 保留规则索引 + 强制触发语；另做去重压缩：§1.3 并入 §2、§3.1 增量化、§4.4 压缩为指针、§6.1/§9.1 命令表精简。
- 评估后保留：fail-closed 三处（语义各异）、§14 速查表（一站式价值）。
- 历史记录（logs/audits/plans/blueprints 中的旧 §15 引用）不改写。

## 改了什么
- 新建：`.agents/skills/plan-audit-archiver/provenance-rules.md`、本日志
- 修改：`AGENTS.md`（33,467→25,782 B，-23%）、`plan-audit-archiver/SKILL.md`（新增 Canonical provenance rules 节 + 2 处引用）、`audit-report-template.md`（2 处）、`deterministic-implementation-planning/SKILL.md`（2 处）、`blueprint-creation/SKILL.md`（1 处）、`validate-audit.ts`（3 条错误消息指向新正本）
- 验证：`bun test validate-audit.test.ts` 44 pass / 0 fail；全部文件过写入完整性闸门

## 更新了什么文档
- `AGENTS.md`、`.agents/skills/plan-audit-archiver/provenance-rules.md`（新建）、3 个 SKILL.md、`audit-report-template.md`
