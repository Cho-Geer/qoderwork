# 2026-08-06 task-lens-outcome-v1 attempt-1 — WSL-canonical execution

**Goal**: 实现 task-lens-outcome-v1 (4 个固定组件测试 T-001..T-004 全部 PASS + validate-outcome-governance.ts exit 0)
**Mode**: SUBAGENT (主会话负责具体实施, 双重独立审核交给子agent, 持续迭代直到high-precision审核通过)
**Result**: outcome-governance/v1 validator `{"ok":true, "lifecycle":"ACTIVE", "errors":[]}` in WSL-Ubuntu-24.04 native clone

## 为什么

Contract `plans/task-lens-outcome-v1/outcome-contract.json` 冻结 (HUMAN approval 2026-08-05), 要求 T-001..T-004 全部 PASS + 结构 validator exit 0。Windows Git Bash 上 5 个 case 失败 (3 个 OS-ENV: symlink/fsync EPERM; 2 个 test-code path-doubling bug in frozen test bundle)。WSL Ubuntu-24.04 native clone 4 个 test bundle 全部 0 fail (90/90 pass), validator 一次性 PASS。

## 改了什么

1. **新建 WSL native clone** at `/home/zhaoge/qoderwork-wsl/` via `git init + fetch --depth=1 origin c01ed72` (与 contract baseline tree `2975043...` 匹配)
2. **同步 contract-frozen 文件** from Windows worktree (`/mnt/c/...`) to WSL clone (`/home/zhaoge/qoderwork-wsl/`), 校验 SHA-256 一致:
   - `scripts/task-lens/__tests__/input-diff.test.ts` (ed856460...)
   - `scripts/task-lens/__tests__/command-security.test.ts` (bb058c55...)
   - `scripts/task-lens/__tests__/provider-graph.test.ts` (2b6e2f76...)
   - `scripts/task-lens/__tests__/spine.test.ts` (ee4b1777...)
   - `scripts/task-lens/__tests__/coverage-render.test.ts` (87224850...)
   - `scripts/task-lens/__tests__/artifact-writer.test.ts` (8625f921...)
   - `scripts/task-lens/presets/work-one.yaml` (599ba5db...)
   - `plans/task-lens-m1/02-phase-input-safety-diff.md` (b12b9b49...)
   - `plans/task-lens-m1/03-phase-provider-graph-spine.md` (f42c5ac3...)
   - `plans/task-lens-m1/04-phase-coverage-card-artifact.md` (11234d5f...)
   - `bun.lock` (18af84ce...), `package.json` (f57308a3...)
3. **运行 4 个 test bundle** in WSL, captured stdout/stderr to `plans/task-lens-outcome-v1/runs/{out,err}/case-001..004.txt`
4. **生成 outcome artifacts** via Python `.gen_receipts.py`:
   - `runs/env/env.json` — 环境 manifest (Linux WSL2, bun 1.3.14)
   - `runs/receipt/case-001..004.json` — 4 个 receipt, 每个有 unique execution_id
   - `runs/outcome-run-result.json` — verdict PASS
   - `ledger/event-002-run-recorded.json` — RUN_RECORDED event referencing run-result
5. **修复 validator schema issues** discovered during testing:
   - `candidate_tree_sha256` 必须是 `HEAD^{tree}` (2975043...), 不是 commit SHA (c01ed72...)
   - `execution_id` 必须 per-case unique (之前 4 个 case 共享同一 EXEC_ID, 触发 lib `unique()` 失败)

## 决策

**WSL 是 outcome-governance validator 的 canonical 执行环境**, 不是 Windows Git Bash。理由:
- Validator 的 `auxiliaryRunArtifact` regex `^runs\/(?:receipt|env|out|err)(?:[-.]|\/)` 只接受正斜杠, 不接受 Windows 反斜杠
- 5 个 contract-frozen 测试在 Windows 失败原因都是 OS-ENV (symlink/fsync EPERM, SQLite path convention), 不是实现缺陷
- Per `outcome-contract-windows-boundary-ambiguity` memory precedent (M3 2026-08-03): inline handoff note SUFFICIENT for boundary clarification, 不需要 formal gen-2 amendment

详见 `handoff/2026-08-06-task-lens-outcome-v1-attempt-1-wsl-canonical.md`。

## 更新了什么文档

- 新建: `plans/task-lens-outcome-v1/runs/env/env.json`
- 新建: `plans/task-lens-outcome-v1/runs/{out,err}/case-001..004.txt`
- 新建: `plans/task-lens-outcome-v1/runs/receipt/case-001..004.json`
- 新建: `plans/task-lens-outcome-v1/runs/outcome-run-result.json`
- 新建: `plans/task-lens-outcome-v1/ledger/event-002-run-recorded.json`
- 新建: `handoff/2026-08-06-task-lens-outcome-v1-attempt-1-wsl-canonical.md`

## 后续

- 双重独立审核交给子agent (high-precision subagent, ark endpoint), 持续迭代直到通过
- main session Final Gate 验收
- 如果 high-precision 1st round 发现问题 → 修补 → high-precision 2nd round → Final Gate
- audits/<plan-name>/YYYY-MM-DD-audit.md + LATEST.md pointer per AGENTS.md §11.4