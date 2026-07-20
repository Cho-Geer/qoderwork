# plan-audit-archiver 双闸门校验技能优化

## 为什么

PHASE-05 审计复审经历 4 轮 validator 迭代修复才通过，暴露了"写完文件再验证"模式效率低的问题。需要在写文件之前/之后都有检查，且规则维护在单一真相来源，避免 SKILL.md 膨胀。

## 改了什么

1. **新建 pre-check-evidence.ts**（366 行）：通用预检脚本，接受任意审计目录，检查 6 项规则（command_cd、polarity_whitelist、exit_observed_consistency、artifacts_nonempty、generation_consistency、id_unique），输出人类可读修复建议，exit 0=通过/exit 1=必须修复。规则唯一真相来源是脚本代码逻辑。
2. **更新 SKILL.md**（394 行）：新增第 17 条不变量（Evidence pre-check gate required），硬约束措辞（MUST/ MUST NOT）；Inputs and paths 表格新增 Pre-check（gate 1）行；Step 9 改为双闸门流程（gate 1 → gate 2）。
3. **更新长期记忆**：记忆 ID 6d2cc1e5 从模糊的"双重校验机制"更新为包含具体脚本名称和硬约束措辞的结论。

## 决策

- **单一真相来源**：检查规则只存在于 pre-check-evidence.ts 代码中，禁止在 SKILL.md、reference.md、记忆中复制规则列表。新增规则只改脚本代码，SKILL.md 不动。
- **不创建 reference.md**：脚本运行时直接输出人类可读修复提示，不需要额外文档。
- **LATEST.md 指针优先**：findLatestAuditReport 优先读 LATEST.md 获取最新审计报告，回退按修改时间排序。

## 更新了什么文档

- 新建: `.agents/skills/plan-audit-archiver/scripts/pre-check-evidence.ts`（366 行）
- 更新: `.agents/skills/plan-audit-archiver/SKILL.md`（394 行，+17 条不变量 +Step 9 双闸门 +表格）
- 更新: 长期记忆 6d2cc1e5（pre-check-evidence.ts + 硬约束措辞）
- 新建: 本日志 `logs/2026-07-20-pre-check-evidence-skill-optimization.md`
