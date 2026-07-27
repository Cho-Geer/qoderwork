# 2026-07-26 — audit-governance v3 validator path fix

## 为什么
v3 PLAN_SET 准入器 `validate-plan.ts` 把 PLAN_SET 目录作为 root 传给 `guardRelativePath` 解析 canonical contract 与 approval decision。这两个是受信任权威文档，按设计位于 PLAN_SET 目录之外，导致任何引用外部 canonical 的正式 v3 PLAN_SET 都报 ERR_PATH_GUARD 无法准入。

## 改了什么
- `validate-plan.ts`：新增第二位置参数 `governanceRoot = process.argv[3]`；canonical/approval 相对路径改为对 governanceRoot 解析（复用 guardRelativePath，root 换成 governanceRoot）；governanceRoot 缺失/非目录时 fail-closed。
- `validate-plan.test.ts`：构造 governance root，权威文档置于 PLAN_SET 目录之外、governance root 之内；调用传第二参数；保留 GPOS-001/GNEG-001~004，新增 GPOS-002（外部权威正例）、GNEG-005（绝对路径）、GNEG-006（逃逸路径）。
- `00-plan-index.md`：canonical/approval 路径改为 governance-root-relative，SHA-256 不变。
- `99-final-verification.md`：固定验证命令补 governanceRoot 参数。

## 决策
绝对路径、含 NUL、逃出 governanceRoot 一律 ERR_PATH_GUARD；sha256 比对、schema-pair、HUMAN_USER APPROVED 绑定与错误码语义不变；共享 parser 未改动。

## 更新了哪些文档
- 修改：validate-plan.ts、validate-plan.test.ts、00-plan-index.md、99-final-verification.md、logs/INDEX.md
- 新建：本日志
