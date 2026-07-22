# PHASE-06 CLI Smoke Execution Log

## 执行时间

- 执行窗口（来自 stage-results）: `2026-07-22T02:35:47.364Z` (create-a startedAt) → `2026-07-22T02:36:08.363Z` (verify-cleanup finishedAt)
- 总耗时: 约 21 秒
- 记录日期: 2026-07-22

## 完整命令

```bash
cd /home/zhaoge/workspace/qoderwork && XDG_STATE_HOME=/home/zhaoge/.local/state/qoderwork /home/zhaoge/.bun/bin/bun run scripts/test-serve/isolated-serve.ts p0-2 --primary-worktree /home/zhaoge/workspace/opencode/work-one --commit 95405b6eb52750f5c5e84eef75a24bb63c6009d1 --port-a 4003 --port-b 4004 --test-id P0-2-CLI-SMOKE --main-framework-db /home/zhaoge/workspace/opencode/work-one/.opencode/state/framework-state.db
```

参数:
- port-a = 4003
- port-b = 4004
- commit = 95405b6eb52750f5c5e84eef75a24bb63c6009d1
- test-id = P0-2-CLI-SMOKE
- primary-worktree = /home/zhaoge/workspace/opencode/work-one
- main-framework-db = /home/zhaoge/workspace/opencode/work-one/.opencode/state/framework-state.db

执行次数: 恰好一次（无重试）

## Exit Code

`EXIT_CODE=0`

## Pre-Flight 端口确认

执行前确认端口空闲:
- `ss -tln | grep ':4003 '` → 4003_FREE
- `ss -tln | grep ':4004 '` → 4004_FREE

## JSON 结果摘要（stdout）

- ok: `true`
- status: `PASS`
- stderr: 空（无输出）

### 5 个 phase checks（全部 ok:true，failedChecks 均为空）

| Phase | ok | failedChecks |
|-------|:--:|--------------|
| reservations | true | [] |
| coexistence | true | [] |
| attribution | true | [] |
| after-stop-a | true | [] |
| cleanup | true | [] |

### 16 stages 状态（来自 p0-2-stage-results.json，全部 ok）

| # | Stage | Status |
|---|-------|:------:|
| 1 | create-a | ok |
| 2 | create-b | ok |
| 3 | verify-reservations | ok |
| 4 | start-sentinel | ok |
| 5 | start-a | ok |
| 6 | start-b | ok |
| 7 | verify-coexistence | ok |
| 8 | bootstrap-a | ok |
| 9 | verify-attribution | ok |
| 10 | stop-a | ok |
| 11 | verify-after-stop-a | ok |
| 12 | cleanup-a | ok |
| 13 | stop-b | ok |
| 14 | cleanup-b | ok |
| 15 | stop-sentinel | ok |
| 16 | verify-cleanup | ok |

start-a / start-b checks: health=true, serveIdentity=true, sseIdentity=true, sseReady=true

## A/B Run Paths 与 Run IDs

### Run A
- runDirA: `/home/zhaoge/.local/state/qoderwork/qoderwork/test-runs/2026-07-22T02-35-47-406Z-p0-2-cli-smoke-a-2fe75c29`
- run_id_A: `2026-07-22T02-35-47-406Z-p0-2-cli-smoke-a-2fe75c29`
- testId: `P0-2-CLI-SMOKE-a`
- port: 4003
- manifest status: `CLEANED`
- cleanup.status: `completed`

### Run B
- runDirB: `/home/zhaoge/.local/state/qoderwork/qoderwork/test-runs/2026-07-22T02-35-48-008Z-p0-2-cli-smoke-b-64a9bd76`
- run_id_B: `2026-07-22T02-35-48-008Z-p0-2-cli-smoke-b-64a9bd76`
- testId: `P0-2-CLI-SMOKE-b`
- port: 4004
- manifest status: `CLEANED`
- cleanup.status: `completed`

### Sentinel
- sentinelId: `p02-P0-2-CLI-SMOKE-mrvh07x4`

## Cleanup Reports

- cleanup_report_A: `/home/zhaoge/.local/state/qoderwork/qoderwork/test-runs/2026-07-22T02-35-47-406Z-p0-2-cli-smoke-a-2fe75c29/cleanup-report.json`
  - success: true, worktreeRemoved: true, cleanedAt: 2026-07-22T02:36:07.769Z
- cleanup_report_B: `/home/zhaoge/.local/state/qoderwork/qoderwork/test-runs/2026-07-22T02-35-48-008Z-p0-2-cli-smoke-b-64a9bd76/cleanup-report.json`
  - success: true, worktreeRemoved: true, cleanedAt: 2026-07-22T02:36:08.308Z

## 证据文件路径列表

| 证据 | 绝对路径 |
|------|----------|
| stdout 完整输出 | /tmp/p06-stdout.log |
| stderr 完整输出 | /tmp/p06-stderr.log (空) |
| manifest A | /home/zhaoge/.local/state/qoderwork/qoderwork/test-runs/2026-07-22T02-35-47-406Z-p0-2-cli-smoke-a-2fe75c29/manifest.json |
| manifest B | /home/zhaoge/.local/state/qoderwork/qoderwork/test-runs/2026-07-22T02-35-48-008Z-p0-2-cli-smoke-b-64a9bd76/manifest.json |
| stage results | /home/zhaoge/.local/state/qoderwork/qoderwork/test-runs/2026-07-22T02-35-47-406Z-p0-2-cli-smoke-a-2fe75c29/artifacts/p0-2-stage-results.json |
| cleanup report A | /home/zhaoge/.local/state/qoderwork/qoderwork/test-runs/2026-07-22T02-35-47-406Z-p0-2-cli-smoke-a-2fe75c29/cleanup-report.json |
| cleanup report B | /home/zhaoge/.local/state/qoderwork/qoderwork/test-runs/2026-07-22T02-35-48-008Z-p0-2-cli-smoke-b-64a9bd76/cleanup-report.json |
| artifacts dir A | /home/zhaoge/.local/state/qoderwork/qoderwork/test-runs/2026-07-22T02-35-47-406Z-p0-2-cli-smoke-a-2fe75c29/artifacts |
| sentinel marker | /home/zhaoge/.local/state/qoderwork/qoderwork/test-runs/2026-07-22T02-35-47-406Z-p0-2-cli-smoke-a-2fe75c29/artifacts/sentinel-marker.json |

## 结论

CLI 命令执行恰好一次，exit 0，status PASS。16 个 stage 全部 ok，5 个 phase 验证全部通过，
A/B 双 run 均完成 cleanup（status CLEANED，worktree 已移除，framework logs 已归档）。
无 failedChecks，无 convergenceErrors。PHASE-06 CLI smoke 验证通过。
