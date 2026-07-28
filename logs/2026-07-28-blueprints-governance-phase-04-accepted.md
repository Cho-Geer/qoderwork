# 2026-07-28 — blueprints-governance PHASE-04 ACCEPTED (spec sync：blueprint-creation skill 模板 + AGENTS.md §3/§11 + documents/INDEX.md, LATEST pointer published)

## 为什么

PHASE-03 ACCEPTED 后执行 PHASE-04：把已落地的元数据 + 归档模型（四字段头部 / 七值状态 / 三类因果边 / 命名 / 归档 / 移动修改禁令）同步回活规范源（blueprint-creation skill 模板、AGENTS.md、documents/INDEX.md），使 skill 所教与文件实际携带一致。纯规范/文档同步，无代码改动。完整 v3 audit 工具链签发（两道闸门 exit 0 + finalize CAS）。

## 改了什么 / 更新文档

- **修改** `.agents/skills/blueprint-creation/SKILL.md`：输出模板头部替换为 BP §2.2.2 四字段（创建日期/更新日期/状态/相关蓝图）；新增「头部元数据规范」节（七值状态 BP §2.2.3 + 三类边 被取代/前置依赖/被取代（机制吸收） BP §2.2.4 + 单边记录规则 + 命名 `blueprint-<topic>.md` + 归档 `archive/YYYY-MM/` 按写作月 + 移动/修改禁令 fail-closed）；陷阱 #8 改为保存位置与命名 + INDEX 登记 + 归档 + 禁令；新增陷阱 #11「不要编辑冻结绑定的蓝图」（v3 实测命中，sha256 `a510b7a8...`）
- **修改** `AGENTS.md`：§3 目录树增加 `blueprints/INDEX.md` 与 `blueprints/archive/`（树 + §3.1 模块说明）；新增 §11.5「蓝图索引与归档」维护义务（镜像 logs/INDEX.md 与 documents/INDEX.md 义务，含单源真相与禁令）
- **修改** `documents/INDEX.md`：最近更新横幅改为 PHASE-01~04 实施纪要；新增 2 行条目（blueprints/INDEX.md ~78、blueprint-blueprints-governance.md ~302）；新增 2 条阅读建议（蓝图生命周期治理 / 创建新 blueprint）；全部 blueprints/ 引用解析到 root 现存文件（零归档条目漂移）
- **新建** `audits/blueprints-governance/phase-04-scope-lock.yaml` + `.json`（FROZEN, APPROVED; lock_id BLUEPRINTS-GOVERNANCE-PHASE-04-SCOPE-LOCK-20260728; json sha256 `e8ca6ffd...`；REQ-003/REQ-004 均 STATIC，PLAN-REQ-006/007 IN_SCOPE）
- **新建** `evidence/pre-change-PHASE-04.json`（`c6c8211e...`）+ `verdict-state-PHASE-04.json`（`7f7b7f4e...`，work-one clean）+ `PHASE-04-1/ev-001~012`（6 正：four-fields/seven-values/three-edges/index-duty/dir-tree/documents-synced；6 负静态缺失夹具：old-vocabulary/edge-missing/naming-missing/duty-missing/tree-missing/archived-drift，全部 FAIL 如预期）
- **新建** `2026-07-28-audit-phase-04.md`（validate-audit.ts `{"valid": true}` exit 0；pre-check-evidence.ts 0 issues）+ `2026-07-28-audit-phase-04-report.json`（`842d7c23...`）；**轮换** `LATEST.md`（PHASE-03 pointer 改名 `LATEST-phase-03-superseded.md` 保留）

## 决策

- **PHASE-04 ACCEPTED**：REQ-003/REQ-004（STATIC）PASS，6 POSITIVE + 6 NEGATIVE controls；STATIC 需求级 negative_control 为 NOT_APPLICABLE_STATIC（command/method/expected/observed = N/A，evidence = not_applicable_for_static_requirement，依 PHASE-01 先例），负控以补充静态缺失夹具 EV-007~012 提供敏感度
- **工具链坑（续）**：① scope-lock 时间戳必须是真实 UTC（未来时间触发 TIMESTAMP_IN_FUTURE + FREEZE_AFTER_SWEEP）；② requirement.source 必须落在 baseline.plan_sources 路径集内（改用 99-final-verification.md#7-global-verification-and-evidence）；③ 报告全文（含收据命令逐字拷贝）不得含 `<...>` 角括符（ANGLE_PLACEHOLDER），EV-009 命令以「命名规范」字面量替代 `blueprint-<topic>.md` 字面量；④ pre-check-evidence.ts 以审计目录为根解析 ledger 路径，需工作区根级临时 contract JSON；⑤ finalize 前须轮换 LATEST.md 并删除中间 report.json（wx 保护）
- v3 蓝图全程未动（sha256 `a510b7a8...` 不变）；bun.lock 不变；仅改 3 个允许文件 + 本 phase 审计基建

## 风险与后续

- 下一步：PHASE-05（lint 脚本 scripts/check-blueprint-status.ts + 全通过夹具 + 9 单失败突变 + tsc/bun test，bun.lock 不变）
