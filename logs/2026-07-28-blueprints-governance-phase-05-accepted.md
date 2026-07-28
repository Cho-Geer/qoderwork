# 2026-07-28 — blueprints-governance PHASE-05 ACCEPTED (M8 漂移 lint：scripts/check-blueprint-status.ts 9 项检查 + 全通过夹具 + 9 单失败突变, LATEST pointer published)

## 为什么

PHASE-04 ACCEPTED 后执行 PHASE-05：落地 BP §2.2.8 的 M8 漂移 lint。新增只读脚本 `scripts/check-blueprint-status.ts`，对 PHASE-03/04 已标准化的头部 + INDEX 运行 9 项漂移检查；纯读取 + 报告，不修改 blueprints/、不写业务状态、不引入 npm 依赖。完整 v3 audit 工具链签发（pre-check 0 issues + validate-audit `{"valid": true}` exit 0 + finalize CAS）。

## 改了什么 / 更新文档

- **新建** `scripts/check-blueprint-status.ts`：导出 `checkBlueprintStatus(options?: { blueprintsDir?: string }): { ok, failedChecks, details }`；9 项检查各为独立函数返回 `{ pass, failures }`：(1) four_field_existence 四字段存在性；(2) status_enum 状态 ∈ 七值；(3) pause_requires_cause 已暂停⇒暂停于边非空；(4) edge_target_exists 边目标文件存在；(5) pause_chain_acyclic 暂停链无环；(6) update_date_vs_git 更新日期 vs `git log -1 --format=%ai`（豁免文件跳过，±1 日容差吸收时区）；(7) index_reverse_view INDEX 反向视图与单边边一致（比较 (subject, dependent) 对集合）；(8) index_coverage INDEX 活跃+已闭环+已归档+豁免清单 与实际目录文件集合一致；(9) archived_not_referenced 归档文件不被活跃 plans//audits/ 新引用（排除 blueprints-governance 治理 provenance 子目录）。仅用 node:fs / node:path / node:child_process。CLI（`import.meta.main`）exit 0 = 零漂移、非零 = 漂移清单。
- **新建** `scripts/__tests__/check-blueprint-status.test.ts`（bun:test，14 测试）：all_pass_zero_drift（当前真实 blueprints/ 零漂移 + 最小临时夹具零漂移 + 9 检查名稳定）；single_failure_per_check（9 个单失败突变，每个恰好失败一项、其余 8 项通过；突变夹具写入 OS 临时目录，绝不触碰真实 blueprints/；check 6 突变用临时 git 仓库控制提交日期；附 check 9 治理 provenance 豁免负例）；cli_exit_zero（`bun run scripts/check-blueprint-status.ts` exit 0）。
- **新建** `audits/blueprints-governance/phase-05-scope-lock.yaml` + `.json`（FROZEN, APPROVED; lock_id BLUEPRINTS-GOVERNANCE-PHASE-05-SCOPE-LOCK-20260728; json sha256 `f83922d1...`；REQ-005 BEHAVIORAL，PLAN-REQ-008 IN_SCOPE；positive_control EV-001 / negative_control EV-002 REQUIRED）
- **新建** `evidence/pre-change-PHASE-05.json`（`5cc4881a...`）+ `verdict-state-PHASE-05.json`（`cc5aa525...`，canonical `3d6fe953...`，work-one clean）+ `PHASE-05-1/ev-001~010`（5 正：all-pass lint / single-failure 过滤测试 / typecheck / bun test 全量 / bun.lock 不变；5 负单失败突变夹具：四字段缺失 / 非法状态 / INDEX 覆盖缺口 / 边目标缺失 / 活跃计划引用归档文件，全部 exit 1 如预期）
- **新建** `2026-07-28-audit-phase-05.md`（validate-audit.ts `{"valid": true}` exit 0；pre-check-evidence.ts 0 issues）+ `2026-07-28-audit-phase-05-report.json`（report sha256 `a60cb7a1...`，report-doc sha256 `e744a9ab...`）；**轮换** `LATEST.md`（PHASE-04 pointer 改名 `LATEST-phase-04-superseded.md` 保留）→ 指向 PHASE-05 report（settles canonical `39235a42...` + scope-lock `f83922d1...`）

## 决策

- **PHASE-05 ACCEPTED**：REQ-005（BEHAVIORAL）PASS；positive_control EV-001（当前状态零漂移 exit 0）+ negative_control EV-002（四字段突变夹具 lint exit 1，REQUIRED 负控 observed FAIL）；补充 5 正 + 5 负 EV 收据提供敏感度。
- **check 9 设计要点**：归档文件引用扫描排除 `plans/blueprints-governance/` 与 `audits/blueprints-governance/` 治理 provenance 子目录——这些是执行归档操作本身的冻结证据（PHASE-02 审计链），其对归档文件的引用属历史记录而非「活跃计划新引用」；实测该子目录外零引用，all-pass 成立。
- **check 8 设计要点**：INDEX 覆盖集合 = 活跃 ∪ 已闭环 ∪ 已归档 ∪ 豁免清单（v3 豁免文件在豁免清单而非三段，须计入覆盖），与实际目录（root 除 INDEX ∪ archive）相等（31 == 31）。
- **工具链坑（续）**：① EV 收据 `--verdict-state-sha256` 必须用 capture-state 输出的 canonical_sha256（剔除 captured_at），否则 EVIDENCE_RECEIPT_BASELINE_MISMATCH；② receipt-id 须三位（EV-001 非 EV-01）；③ prepare-audit 会按收据自动派生 requirement controls，需手工改回与冻结 scope-lock 一致的 EV-001/EV-002 并同步叙述表；④ finalize 前须轮换 LATEST.md 并删除中间 report.json（wx 保护）；⑤ 叙述全文（含收据命令逐字拷贝）不得含 REPLACE_/TBD/TODO/`<...>` 角括符。
- v3 蓝图全程未动（sha256 `a510b7a8...` 不变）；bun.lock 不变；仅新增 2 个允许脚本文件 + 本 phase 审计基建；blueprints/ 内容零修改（lint 只读）。

## 风险与后续

- 下一步：CONTINUATION-001（M9 停滞 + 唤醒双扫描接入会话启动检查或审计 finalize 环节），交后继 PLAN_SET；本 PLAN_SET（PHASE-01~05）至此全部 ACCEPTED。
