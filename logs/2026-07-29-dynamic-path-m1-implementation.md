# 2026-07-29 — path-dynamic-resolution M1 实施完成

## 总结

完成 `plans/path-dynamic-resolution-m1/` 全部 4 个 phase 实施与审计闭环。

## 变更摘要

- **PHASE-01 (冻结范围与路径清单)**: rg `--hidden --json -F '/home/zhaoge/'` 扫描生成 2504 unique entries (`audits/path-dynamic-resolution-m1/evidence/path-scan.jsonl` + `path-inventory.json`)，classify_counts = {PRESERVE_HISTORY: 1838, DOC_EXAMPLE: 522, DEFERRED: 80, LOCAL_CONFIG: 56, TEST_FIXTURE: 5, MIGRATE: 3}。PDR-CLASS 通过（`failedChecks: []`），PHASE-01 scope-lock + pre-change + verdict-state receipts + EV-001 + audit-report + progression-receipt 全部生成并接受。
- **PHASE-02 (workspace resolver)**: 新增 `scripts/lib/workspace-paths.ts`（resolveWorkspacePaths/validateWorkOneRoot/resolveTool + WorkspacePathsError）+ `scripts/lib/__tests__/workspace-paths.test.ts`（13 tests）+ `scripts/local-paths.example.json` + `.gitignore` 含 `scripts/local-paths.json` + `scripts/start-serve.ts` 接入 resolver（保持 `--work-dir` precedence 与 `scripts/.env` 独立加载）+ `scripts/__tests__/start-serve-paths.test.ts`（6 tests）。19/19 component tests + typecheck exit 0。
- **PHASE-03 (test-serve 消费点迁移)**: 修改 `scripts/test-serve/run-context.ts`（getDefaultPrimaryWorktree 委托 resolver 无参数）+ `scripts/test-serve/process.ts`（getSseDaemonPath 用 import.meta.dir + SSE_DAEMON_PATH_INVALID）+ `scripts/test-serve/bootstrap.ts`（privilege 动态导入改用 `pathToFileURL(resolvedPrivilegePath).href`）+ `scripts/test-serve/isolated-serve.ts`（导出 `resolvePrimaryWorktreeFromArgs` 纯解析 seam）。更新 `bootstrap-import-source.test.ts` 匹配新合同 + 新增 `isolated-serve-paths.test.ts`（8 tests）。34/34 component tests + typecheck exit 0。
- **PHASE-04 (M1 证据收口与后续交接)**: 新增 `audits/path-dynamic-resolution-m1/continuation-register.json`（14 m1_paths + 55 deferred = 51 scripts/_b*/_d*/_e2e*/audit_*/e2e-*/live-*/oc_*/_restart_*/_tmp_* 等 + 4 IDE LOCAL_CONFIG）+ `phase-04-audit.md`（v3 schema, verdict=ACCEPT）+ `logs/2026-07-29-dynamic-path-m1-implementation.md`（本文）+ `progression-receipt-PHASE-04.json`。更新 `documents/INDEX.md` 第 40 行 path-dynamic-resolution-m1 入口 + `logs/INDEX.md`（active log + path-dynamic cluster）。

## 决策

- **路径解析器优先链**: CLI > ENV > LOCAL_CONFIG > DEPRECATED_DEFAULT。First candidate that exists but fails validation throws (no fall-through)。Validator throws 稳定诊断（`WORK_ONE_ROOT_INVALID` / `LOCAL_PATHS_INVALID` / `TOOL_BUN_INVALID` / `TOOL_CODEGRAPH_INVALID` / `SSE_DAEMON_PATH_INVALID`）。
- **脚本/.env 职责分离**: `scripts/lib/workspace-paths.ts` 不得 import 或读取 `scripts/.env`；`scripts/start-serve.ts` 仍通过独立 `loadEnv(ENV_FILE)` 加载（隔离测试 `start-serve-paths.test.ts` 用静态源码检查验证不污染）。
- **file-URL 动态导入**: `loadPrivilegeService` 用 `pathToFileURL(resolvedPrivilegePath).href` 替代 `${manifest.paths.worktreeDir}/.opencode/service/dispatch/privilege.ts` 模板字符串。Win/macOS/Linux 一致。
- **PHASE-04 evidence ceiling**: 全部 M1 证据 ceiling = `component` (PHASE-02/03) 或 `manual` (PHASE-01/04)。runtime-smoke 与 live-E2E 在 M1 标记为 `NOT-RUN`，需要后续 PLAN_SET 申请。
- **后续 PLAN_SET 规则**: continuation-register.json 中所有 DEFERRED / LOCAL_CONFIG 行 `required_admission = "APPROVED_SUCCESSOR_PLAN"`。任何后继计划必须 human-approved per provenance-rules P-02 §2 才可动这些路径。

## 文档变更

- 新增: `plans/path-dynamic-resolution-m1/00-plan-index.md`（已有 → 状态全部翻为 ACCEPTED）
- 新增: `plans/path-dynamic-resolution-m1/01-phase-freeze-inventory.md` / `02-phase-workspace-resolver.md` / `03-phase-test-serve-consumers.md` / `04-phase-runtime-handoff.md`（4 phase 文件 + completion gate `[X]` 全部打勾）
- 新增: `scripts/lib/workspace-paths.ts`（379 行，4 exports）
- 新增: `scripts/lib/__tests__/workspace-paths.test.ts`（13 tests）
- 新增: `scripts/local-paths.example.json`（17 行）
- 新增: `scripts/__tests__/start-serve-paths.test.ts`（6 tests）
- 新增: `scripts/test-serve/__tests__/isolated-serve-paths.test.ts`（8 tests）
- 修改: `.gitignore`（添加 `scripts/local-paths.json`）
- 修改: `scripts/start-serve.ts`（导入并委托 resolver，保持 .env 独立加载）
- 修改: `scripts/test-serve/run-context.ts`（getDefaultPrimaryWorktree 委托 resolver）
- 修改: `scripts/test-serve/process.ts`（删除硬编码 SSE_DAEMON_PATH，替换为 getSseDaemonPath）
- 修改: `scripts/test-serve/bootstrap.ts`（loadPrivilegeService 用 pathToFileURL）
- 修改: `scripts/test-serve/isolated-serve.ts`（导出 resolvePrimaryWorktreeFromArgs seam）
- 修改: `scripts/test-serve/__tests__/bootstrap-import-source.test.ts`（匹配新合同）
- 新增: `audits/path-dynamic-resolution-m1/approval-decision.json`
- 新增: `audits/path-dynamic-resolution-m1/scope-lock-PHASE-{01,02,03,04}.json`（4 个 scope-lock 全部 FROZEN + human-approved）
- 新增: `audits/path-dynamic-resolution-m1/evidence/pre-change-PHASE-{01,02,03,04}.json` + `verdict-state-PHASE-{01,02,03,04}.json`（8 个 receipts，work-one HEAD 64df828 干净锚定）
- 新增: `audits/path-dynamic-resolution-m1/evidence/path-scan.jsonl`（1.3MB，5008 matches / 613 files）+ `path-inventory.json`（2504 unique entries）
- 新增: `audits/path-dynamic-resolution-m1/evidence/EV-001..EV-012-receipt.json`（12 个 EV receipts）
- 新增: `audits/path-dynamic-resolution-m1/evidence/progression-receipt-PHASE-{01,02,03,04}.json`（4 个 progression receipts）
- 新增: `audits/path-dynamic-resolution-m1/2026-07-29-phase-01-audit.md` / `2026-07-29-phase-02-audit.md` / `2026-07-29-phase-03-audit.md`（3 个 v3 audit reports，ACCEPT）
- 新增: `audits/path-dynamic-resolution-m1/phase-04-audit.md`（PHASE-04 closure audit）
- 新增: `audits/path-dynamic-resolution-m1/continuation-register.json`（14 m1_paths + 55 deferred）
- 修改: `documents/INDEX.md`（第 40 行 path-dynamic-resolution-m1 入口摘要更新为 M1 完成）
- 修改: `logs/INDEX.md`（添加 active log + path-dynamic cluster）

## 验证

- `validate-phase-progression.ts plans/path-dynamic-resolution-m1 PHASE-04` → `ok: true, errors: []`
- `validate-audit.ts audits/path-dynamic-resolution-m1/2026-07-29-phase-{01,02,03}-audit.md` → `valid: true, errors: []`
- `validate-audit.ts audits/path-dynamic-resolution-m1/phase-04-audit.md` → `valid: true, errors: []`
- `bun test` PHASE-02 测试集 (workspace-paths + start-serve-paths) → 19/19 PASS
- `bun test` PHASE-03 测试集 (run-context + process + bootstrap-import-source + isolated-serve-paths) → 34/34 PASS
- `bun run typecheck` → exit 0
- work-one HEAD `64df828d56611ac121baccfaf666f147980aec85` 干净（pre-change / verdict-state 全部 0 entries）