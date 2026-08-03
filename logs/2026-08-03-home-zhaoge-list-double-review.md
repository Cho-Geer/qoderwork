# 2026-08-03: AGENTS.md + .agents/skills /home/zhaoge 清单（双重复审定稿）

## 为什么
- 用户要求汇报 AGENTS.md 3 处 cd 模板 + 18 个 skill 文件 /home/zhaoge 命令
- 主会话原汇报 per-file 数错 + 桶分布错 + nature 分类错 + scope 严重低估
- 经 M3 + GLM-5.2 串行复审 + 主会话 13 项 Python byte-level 独立验证后修正

## 改了什么
- handoff/native-windows-verification.md 末尾追加新章节（AGENTS.md 13 全列 + 18 skill 168 + 4 tier scope）
- 新建本日志
- 未修改既有 21-item 清单 / 集成 scan / 实测章节

## 决策
- per-file 计数修正: serve-api/reference-operations.md (29→32), opencode-framework-dev/SKILL.md (14→16)
- 桶分布修正: High 6 / Mid 5 / Low 7（原报 High 4 / Mid 6 / Low 8）
- nature 修正: TS constants 3 文件 5 refs (原报 2 文件 3 refs); audit-report-template 2 JSON + 1 cmd (原报 3 JSON)
- scope 拆分 4 tier: (a) 用户作用域 181 / (b) 其他源码 ~1,230 / (c) audits/ 历史 19,939 / (d) 二进制 105

## 更新了什么文档
- handoff/native-windows-verification.md（追加新章节，原有章节未改，append-only）
- logs/2026-08-03-home-zhaoge-list-double-review.md（新建）