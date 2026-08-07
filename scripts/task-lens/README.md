# Task Lens — CLI / Config / Artifact / Exit Contract

Task Lens M1：基于 diff + codegraph + 提交三件 artifact（card.md / graph.json / receipt.json）生成评审卡片，并采集 generated/feedback 双事件 metrics。本文记录 CLI、退出码、metrics 协议与环境要求（PHASE-05-v2 交付）。

## CLI 命令契约（05-phase §6.8）

```bash
bun run task-lens [generate] --project ABS --mode working-tree|commit --out ABS \
  [--base SHA] [--config FILE] [--coverage LCOV] [--entry FILE#NAME]
bun run task-lens feedback --out ABS --task-id ID --useful yes|no \
  --load-reduced yes|no --issues-found N --issues-guided-by-card N \
  --review-minutes N [--notes TEXT]
bun run task-lens metrics summarize --out ABS [--json]
```

- `generate`：config → diff → provider → graph → spine → coverage → card → 三件 artifact 原子提交 → lock+append+fsync generated event。同 taskId 重跑走 verified recovery。
- `feedback`：task dir 与 generated event 必须 FOUND；feedback 每任务最多一条。
- `metrics summarize`：只读聚合；`--json` 输出机器可读 `MetricsSummary`。

## 退出码契约（§6.9）

优先级 `21 > 20 > 12 > 10 > 13 > 2 > 1`：

| Code | 含义 |
|---|---|
| 0 | generate success / feedback OK / summary PASS |
| 1 | 未分类异常 |
| 2 | degraded（truncation/仅删除/coverage 缺失）或 summary INCOMPLETE |
| 10 | 参数/配置/路径非法、feedback 缺 task/generated 或重复 |
| 12 | provider 不可用 |
| 13 | empty diff |
| 20 | 子进程失败/超时/signal/truncation |
| 21 | artifact 完整性失败 / 锁超时 / generated FOUND 或 UNAVAILABLE / metrics 损坏 |

summary 三态：`INCOMPLETE=2`、`FAIL=1`、`PASS=0`。

## TASK_LENS_METRICS_ENV（必设）

调用者**必须**在运行 generate/feedback/metrics 时设置：

```bash
TASK_LENS_METRICS_ENV=wsl|gitbash
```

- 值域仅 `wsl` / `gitbash`；**未设置默认 `wsl`**（canonical 环境）。
- metrics lock `owner.json` 的 `env` 字段由此变量注入，CLI/模块**不做平台自动检测**（避免 Git Bash 下未设置时被误标 `wsl`，破坏双环境 source fidelity）。
- 双端各自 evidence root 内 owner.json 必须与所在环境一致。

## Metrics 协议（§6.5/6.6/6.7）

- **Lock**：lock dir = `<out>/.task-lens-metrics.lock`，`mkdir` 原子获取（第二次必须 EEXIST）；50ms 重试 / 5000ms 超时 → exit21；owner.json=`{pid,createdAt,taskId,event,env}`；禁止 PID 猜测与 stale-lock 自动删除；仅 owner `finally` 删除自己的 lock dir。
- **Append**：`metrics.jsonl`，锁内先完整 parse 再 `open("a")` 写 `JSON.stringify(event)+"\n"`，fsync file + out dir（Windows 目录 fsync EPERM 跳过）。
- **Recovery**（generated）：任务目录 FOUND 时只读三 artifact 校验 schema/taskId/hash/card headings；metrics 必须 readable+parse+success；generated `FOUND`→exit21，`UNAVAILABLE`→exit21，`NOT_FOUND`→从 artifacts 重建 exact GeneratedEvent 并 append。不重写 artifact；feedback 不可由 recovery 生成。
- **Feedback**：task dir + generated 必须 FOUND；feedback `NOT_FOUND` 才 append；缺失/重复 → exit10；metrics unavailable → exit21。

## Evidence root（双端各自独立）

- **WSL**：`${HOME}/.local/state/qoderwork/task-lens/m1-validation/PHASE-05-v2`
- **Git Bash**：`%LOCALAPPDATA%\qoderwork\task-lens\m1-validation\PHASE-05-v2`
- 任一端 FAIL 不得用另一端 PASS 覆盖；verdict 不合并。
