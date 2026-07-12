# 修复脚本对 `.task_temp` 的根目录解析

**为什么**: 删除 qoderwork 本地 `.task_temp` 后，部分脚本仍把 `OPENCODE_ROOT` 当必填或默认回落到当前目录，容易误解析到 qoderwork 根目录并导致找不到运行态文件。

**改了什么**:
- `scripts/diag-handover-path.ts` — `OPENCODE_ROOT` 改为可选，默认回落到 `work-one` 根目录。
- `scripts/diag-handover-path.ts` — `gate_sessions` 查询从 `gate_status` 改为 `status AS gate_status`，修复当前 DB schema 漂移。
- `scripts/regress-parent-child.ts` — 同步改为默认回落到 `work-one`，避免 gate deliverables 测试误读 qoderwork。
- `scripts/_d3_live.ts` — `audit.jsonl` 路径不再回落到 `"."`，统一指向 `work-one/.task_temp/_logs/`。
- `temporary-audits/task-temp-script-inventory.md` — 更新清单状态，标注 A 类脚本已修复。

**决策**: 保留 `OPENCODE_ROOT` 覆盖能力，但把默认行为统一收敛到 `work-one` 权威运行态目录，而不是依赖当前工作目录。
