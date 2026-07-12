# `.task_temp` 脚本清单

更新时间：2026-07-12

## 结论

- `qoderwork/.task_temp` 当前残留已删除。
- repo 内脚本对 `.task_temp` 的使用分成两类：
  - **相对 ROOT / 本地 `.task_temp`**：脚本按 `ROOT` 或 `OPENCODE_ROOT` 解析 `.task_temp/...`，实际命中 qoderwork 还是 work-one 取决于运行时根目录。
  - **明确指向 `work-one/.task_temp`**：脚本直接读取 `/home/zhaoge/workspace/opencode/work-one/.task_temp/...`，与 qoderwork 本地残留无关。

## A. 相对 ROOT 的 `.task_temp`（已修复为默认回落到 work-one）

这些脚本仍按 `ROOT` 或 `OPENCODE_ROOT` 解析 `.task_temp/...`，但默认值已经收敛到 `work-one` 的权威路径，不再隐式回落到 qoderwork 当前目录。

| 脚本 | 行号 | 用途 |
|---|---:|---|
| `scripts/diag-handover-path.ts` | 6, 27, 36 | 默认回落到 `work-one`，解析 `HANDOVER.md` / `TASK_LOG.md` 的默认路径与任务目录 |
| `scripts/regress-parent-child.ts` | 13, 53, 108-114 | 默认回落到 `work-one`，读取 `.task_temp/<gate>/HANDOVER.md`、`TASK_LOG.md` |
| `scripts/_d3_live.ts` | 19-20, 61-65 | 默认回落到 `work-one`，定位 `audit.jsonl` |

## B. 明确读取 `work-one/.task_temp`

这些脚本直接读取 `work-one` 的运行态 `.task_temp`，不依赖 qoderwork 本地残留。

| 脚本 | 行号 | 用途 |
|---|---:|---|
| `scripts/qoder-watcher.ts` | 8-10, 18-19 | 默认消费 `work-one/.task_temp/_logs` 下的 JSONL 流 |
| `scripts/tree-watcher.ts` | 64-67 | 默认读取 `WORK_ONE_ROOT/.task_temp/_logs/quality.jsonl` |
| `scripts/live-question-recovery-e2e.ts` | 30-31 | 读取 work-one DB 和 `.task_temp/_logs` |
| `scripts/_e2e_probe.sh` | 13-14 | tail 指定日期的 skill-summary runtime log |
| `scripts/_e2e_lslogs.sh` | 2-10 | 枚举和统计 `work-one/.task_temp/_logs` |
| `scripts/_e2e_gov_guard.py` | 15-16 | 扫描 `work-one/.task_temp/_logs` 确认治理 guard 命中 |
| `scripts/_e2e_b1_live.py` | 17-18 | 读取固定日期的 skill-summary runtime log |
| `scripts/_e2e_l1001abc_live.py` | 27, 29-32 | 动态定位最新的 skill-summary runtime log |
| `scripts/_tmp_restart_serve.sh` | 18-21 | 重启 serve，并把输出写到 `work-one/.task_temp/_logs/serve-restart.log` |

## C. 仅提及或排除 `.task_temp`，不算读取 qoderwork 残留

这些脚本里出现了 `.task_temp`，但主要是过滤、排除、约束提示，不应算作“读取 qoderwork 本地 `.task_temp` 当前残留”的脚本。

| 脚本 | 行号 | 说明 |
|---|---:|---|
| `scripts/audit_verify.sh` | 10, 12, 17 | grep 排除项 / 候选目录检查 |
| `scripts/audit_refs.sh` | 6, 21 | grep 排除项 / token 列表 |
| `scripts/live-question-recovery-e2e.ts` | 155 | prompt 约束文案，提示不要改 `.task_temp/` |

## 备注

- qoderwork 本地 `.task_temp` 删除后，A 类脚本已经不会再默认误打到 qoderwork 根目录。
- 日常 watcher / live E2E 主路径仍然是 `work-one/.task_temp`，不受本次清理影响。
