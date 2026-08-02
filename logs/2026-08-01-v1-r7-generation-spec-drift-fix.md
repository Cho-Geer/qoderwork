# v1 r7 Generation — Spec Drift Fix

**日期**: 2026-08-01
**Plan**: audit-governance-recovery-v1
**Generation**: r6 → r7
**Blueprint**: blueprint-audit-governance-recovery-v1-r7-and-tiered-provenance.md (Part A)

## 为什么

v1 存在 3 个阻塞性 spec drift + 1 个 pre-existing YAML 缺陷,使 validate-plan.ts 无法 exit 0 且 PHASE-01 无法推进。

## 改了什么

1. **Drift 1 — 占位符填充**:00-plan-index.md 3 个 PENDING_R6_FREEZE 占位符填入真实 SHA-256(canonical SHA / plan-files SHA / decision SHA)。
2. **Drift 2 — verify-final-* flag**:01-phase step 6 模式清单补充 3 个 verify-final-* flag(--verify-final-gate / --verify-final-audit-inputs / --verify-final-audit-regression)+ 双接口设计说明。
3. **Drift 3 — generation 引用漂移**:00-index / 01-phase / 99-final 全部 r5 引用更新为 r7。
4. **范围外修复 — YAML 缩进**:canonical evidence_matrix note block(L1423)缩进 6→8 space,修复 Bun.YAML.parse 失败(pre-existing latent defect,r6 占位符短路掩盖)。
5. **路径迁移**:canonical prewrite_verification_command / phase_01_activation_additions / invariants / evidence note 全部 r6→r7。
6. **materialization overlay**:新增 materialization_commands_r7 段(跳过 test ! -e,flag:"w" 覆盖语义);01-phase 引用该段。
7. **baseline SHA 方案A**:approved-index-baseline-r7.md L20=PENDING_R7_FREEZE(冻结绑定版),live 00-index L20=decision SHA(projection 版)。两者故意不同字节,遵循 r5/r6 先例。

## 决策

- **L20 循环依赖**:validate-plan 要求 L20=decision SHA,但 decision 依赖 baseline SHA(=00-index 含 L20)。无法同时满足 validate-plan + prewrite baseline 校验。采用方案A(baseline 文件 L20=placeholder,live 00-index L20=decision SHA),与 r5/r6 先例一致。
- **HUMAN 授权**:用户授权 r7 generation,approval-request-r7 + approval-decision-r7 在 plan text 落盘前生成(遵循 approval-decision-r6 L81 approval_effect 时序)。
- **不做 materialization**:r7 停留在 plan/audit 文件层,不执行 worktree materialization(用户指示)。

## 更新了什么文档

- `plans/audit-governance-recovery-v1/formal-plan-set/00-plan-index.md`
- `plans/audit-governance-recovery-v1/formal-plan-set/01-phase-foundation-kernel.md`
- `plans/audit-governance-recovery-v1/formal-plan-set/99-final-verification.md`
- `plans/audit-governance-recovery-v1/canonical-requirements-contract.yaml`
- `audits/audit-governance-recovery-v1/`(9 个 r7 artifacts:object-set / files / baseline / request / decision / pending / m1-manifest / p4-boundary / materialization 占位)

## 复审记录

3 轮 high-precision(GLM-5.2)复审:
- R1: REWORK(9 漏点:1 CRITICAL baseline SHA 悬空 + 2 HIGH 路径残留 + 3 MEDIUM + 4 LOW)
- R2: REWORK(RC1 CRITICAL + 漏点7 编号 + R4 materialization r5)
- R3: **ACCEPT** ✓(全部修复正确,无新缺陷)
