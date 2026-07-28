# 2026-07-28 — merge audit-governance-v3 into check-plan

## 为什么

`audit-governance-v3` 分支承载 v3 审计治理升级(Phase 1-5,formal ACCEPT,`audits/audit-governance-evidence-and-status-closure-v3/` 已含 7 个 EV receipts + LATEST.md + 两道闸门 exit 0)。需合入 check-plan 以让 check-plan 共享升级后的 audit 工具链(provenance-rules.md / validate-audit.ts / pre-check-evidence.ts v3 化)。

## 改了什么

- `git merge --no-ff audit-governance-v3` → merge commit `f1047e5`(无冲突,ort 策略)
- 155 文件变更:15235 insertions, 1312 deletions
- 关键同步:audit 工具脚本(SKILL.md / provenance-rules.md / validate-audit.ts / pre-check-evidence.ts / prepare-audit.ts)、v3 formal-plan-set、`audits/audit-governance-evidence-and-status-closure-v3/`、conformance 与 schema-v3 测试

## 决策

- **merge 策略**:`--no-ff`(用户授权;拓扑本可 fast-forward,但强制合并提交保留分支来源记录)
- **冲突预案**:无需(自动 ort 策略解决,无冲突文件)
- **remote 推送**:否(用户授权,本地合入)
- **provenance 校验**:已 Read `provenance-rules.md`;v3 commit `8c5e6c7` 的 audit 工具修改由 `phase-03-scope-lock.yaml` IN-SCOPE 覆盖 + `phase-04-evidence/implementation-verification.md` 4 项 CLOSED 验证,**非 self-referential 越界**

## 风险与后续

- v3 改动了 audit 工具本身;check-plan 上一次 ACCEPT(`ee13890 boundary-contract v1`)在 v3 工具下的兼容性未重跑两道闸门 —— 属不可验证,留待后续 phase 触发时由 audit chain v3 自然校验
- LATEST.md 已确认指向合法 `audit-report.json`(SHA-256 `537e1dcb83c75bce8fc55db6a49ba6132e1beb3ea02e287999219a3d9ff43f8b`)
- 不 push;后续如需发布,需独立 human approval