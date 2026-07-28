# 2026-07-29 — M9 停滞扫描实施（stagnation-scan + audit-finalize 接线）

## 为什么

CONTINUATION-001（M9 停滞/唤醒扫描）的 hook 决策已定为 `audit-finalize`（见 `2026-07-29-continuation-001-m9-decision.md`）。本次落地：每次 `finalize-audit.ts` 发布 LATEST pointer 后，对所有活跃 blueprint 做只读停滞扫描，把结果嵌入 finalize 输出，供后续唤醒/退役流程消费。

## 改了什么 / 更新文档

- **新增** `scripts/lib/stagnation-scan.ts`（182 行）：导出 `scanStagnantBlueprints(options?)`。停滞判定（三条全满足）：
  1. 最近 git commit（author date，`git log -1 --format=%aI`）超过阈值（默认 90 天）
  2. basename 未被任何活跃 LATEST pointer（`audits/*/LATEST.md`）引用
  3. 非豁免（`INDEX.md`、冻结的 v3 blueprint `blueprint-audit-governance-evidence-and-status-closure-v3.md`；归档 blueprint 位于 `blueprints/archive/`，因只枚举根目录而天然排除）
  - 仅用 `node:fs` / `node:path` / `node:child_process`（`execFileSync`，无 shell），零外部依赖
  - 逐文件 fail-open：无法解析 git 日期则跳过（不判停滞）；带 CLI（`--threshold-days=` / `--blueprints-dir=`）
- **修改** `finalize-audit.ts`（+14/-2）：`renameSync` 发布 LATEST 成功后调用扫描，返回对象新增 `stagnation_scan` 字段。扫描纯信息性——**不阻断发布**，try/catch fail-open（异常时内联 `{ error }`，发布本身仍 fail-closed）
- **新增** `scripts/lib/__tests__/stagnation-scan.test.ts`（143 行，6 用例）：当前仓库全 PASS、停滞检出、豁免（INDEX/v3）、LATEST 引用豁免、阈值边界（90 天非停滞 / 91 天停滞）、阈值可配置。临时 git 仓库用 `GIT_CONFIG_GLOBAL=/dev/null` 隔离用户全局配置

## 决策

- **hook = audit-finalize**：扫描在 LATEST 发布*之后*运行，发布成功才触发；扫描错误绝不影响发布（fail-open for scan, fail-closed for publication）
- **边界语义**：`days_since <= threshold` 非停滞（恰 90 天非停滞，91 天停滞）
- **`last_update` 输出** `YYYY-MM-DD`（ISO 截断），`path` 为仓库相对路径（`blueprints/foo.md`）
- **repo root 推导**：默认从模块位置解析；传入 `blueprintsDir` 时取其父目录为 root（同时确定 git cwd 与 `audits/`），使测试可用临时仓库

## 验证

- `bun test scripts/lib/__tests__/stagnation-scan.test.ts` → 6 pass / 0 fail
- `bun test ./.agents/skills/plan-audit-archiver/scripts/__tests__/` → 115 pass / 0 fail（finalize-audit 7/7 无回归）
- `bun run typecheck` → exit 0；`git diff --quiet bun.lock` → 未变更
- `bun run scripts/lib/stagnation-scan.ts` → `total_active=19, stagnant_count=0`（当前全部 blueprint 于 2026-07-28/29 更新）
- 端到端：临时目录成功发布 → 输出含 `stagnation_scan`；对已发布 PHASE-05 跑 CLI → `AUDIT_REPORT_DOC_CONFLICT`（fail-closed，预期）

## 风险与后续

- `scan-governance-surface.test.ts` 有 3 个**既有**失败（clean tree 同样失败，与 M9 无关，属 PHASE-04/05 consumer-local findings），本次未处理
- 当前无 blueprint 被 LATEST 引用，故 LATEST 豁免路径仅由临时仓库测试覆盖
- 后续：唤醒/退役流程（标记「已暂停」+ human review）仍待设计；本扫描仅提供只读信号
