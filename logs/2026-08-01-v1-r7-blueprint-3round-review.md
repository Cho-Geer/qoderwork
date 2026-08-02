# v1 r7 Blueprint — 3 轮 high-precision 复审收敛

> **会话**: 2026-08-01,主会话 GLM-5.2
> **触发**: 用户要求设计整合审计流程优化的 blueprint,经 high-precision 复审循环至通过
> **结果**: blueprint v0.3 经 3 轮复审 PASS;blueprints/INDEX.md 已登记

## 为什么改

9 轮讨论 + 4 轮 plan 复审发现 `plans/audit-governance-recovery-v1/` 存在 3 个阻塞性 spec drift,无法按当前 r6 状态推进。同时确认"审计流程减重优化"不应整合进 v1(4 轮 plan 复审证明会破坏文件所有权),应作为独立 proposal。

## 3 个 spec drift(均 VERIFIED)

1. PENDING_R6_FREEZE 占位符(00-index L12/14/16)→ validate-plan.ts 必然 FAIL
2. verify-final-* flag 无 phase 拥有(canonical final_gate_registry 引用 3 主 flag,PHASE-01 step 6 不含)
3. 跨文件 r5 引用漂移(99-final 8 处 + 00-index 3 处 + 01-phase 1 处)+ bytes-mirror 命名漂移(r4 vs r5)

## 3 轮复审修正历程

| 轮次 | 发现 | 修正 |
|---|---|---|
| R1 | 4 个漏洞:时序违规(HUMAN 步骤 8)/worktree 阻塞/第三 drift 漏判(99-final)/flag 数量(7→3) | v0.2:时序改步骤 3;worktree 给方案;Drift 3 加入;flag 改 3 |
| R2 | 3 个 High:第三 drift 只覆盖 99-final(漏 00-index/01-phase)/worktree 含糊/SHA 不变量未声明 + provenance 缺失 | v0.3:Drift 3 扩 3 文件;worktree 具体化(叠加写入);步骤 5 SHA 比对;provenance_level 声明 |
| R3 | PASS(2 个 Low 瑕疵:YAML 结构含义/git worktree add,实施期解决) | 无修正,直接通过 |

## 核心设计

- **Part A(v1 r7 generation)**:遵循 r5→r6 先例;r6 decision 保留不改(L18-19 authority rule);r7 成为新 authoritative;HUMAN 批准先于 plan text 落盘(L81 approval_effect)
- **Part B(独立 proposal)**:v1 r7 ACCEPT 后启动 `plans/audit-governance-tiered-provenance-v1/`;6 个设计问题(判据/审计者/delta 替代/frozen 覆盖/迁移/flag ownership)

## 更新了什么文档

- 新建:`blueprints/blueprint-audit-governance-recovery-v1-r7-and-tiered-provenance.md`(270 行,v0.3)
- 修改:`blueprints/INDEX.md`(新增活跃条目,总数 31→32)
- 新建:`logs/2026-08-01-v1-r7-blueprint-3round-review.md`(本文)
