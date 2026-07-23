# 修复 plan-audit-archiver worktree 支持缺口 + task-lens-m1 receipt 重做

## 为什么
task-lens-m1 PHASE-01 的 pre-change receipt 错误用 qoderwork worktree 作 `--repository-root`（plan L112-120），导致 PHASE-02 v2.1 审计不可行（validate-audit.ts DIRTY_PATH_OUTSIDE_SCOPE）。根因：技能写于前-worktree 时代，零 worktree 指引；repository_root 规则只活在审计技能，计划编写技能不浮现。

## 改了什么
- AGENTS.md §15：新增 P-07（repository_root 干净锚点规则，worktree 感知）+ P-02 第 3 步点名取值 + footer 日期
- plan-audit-archiver SKILL.md：L210-211 仓库身份字段表泛化、L220-241 选择规则加 worktree 场景段 + 合理化检测、示例 cd 注释泛化
- deterministic-implementation-planning SKILL.md：Boundary 加 plan-audit-archiver 反向引用 + Non-negotiable rules 新增第 12 条
- blueprint-creation SKILL.md：陷阱新增第 10 条（验证计划不得与 §15 provenance 冲突）
- plans/task-lens-m1/01-phase-freeze-gate.md：L112-116 repository-root 改为 work-one + L120 自锁断言对齐
- audits/task-lens-m1/evidence/pre-change-PHASE-02.json：删除错误 receipt，用 work-one 重做（realpath=work-one, head=e65e229, status_entries=0）

## 决策
纯文档修复，脚本代码无需改（5 脚本零 hard-code 路径，git toplevel 校验与 worktree 天然兼容）。框架层+task-lens-m1 一次性闭环。

## 更新了什么文档
- AGENTS.md（§15 P-07 + P-02 + footer）
- .agents/skills/plan-audit-archiver/SKILL.md（仓库身份表 + 选择规则 + 示例）
- .agents/skills/deterministic-implementation-planning/SKILL.md（Boundary + rule 12）
- .agents/skills/blueprint-creation/SKILL.md（陷阱第 10 条）
- plans/task-lens-m1/01-phase-freeze-gate.md（Fixed verification 命令 + 断言）
- audits/task-lens-m1/evidence/pre-change-PHASE-02.json（重做 receipt）
- logs/2026-07-23-fix-worktree-repository-root.md（本日志）
