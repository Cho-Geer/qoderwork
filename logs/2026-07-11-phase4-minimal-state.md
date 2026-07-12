# Phase 4 Minimal State 与 DB Hot-Path Slimming 收口

**为什么**: 路线 Phase 4 目标是把运行时状态收敛到权威 DB、统一审计落盘、收紧 framework-maintenance 边界。本 turn 完成可静态完成的 Step 1/3/5，并明确标记需 serve session 的 runtime 尾巴（Step 2/4/6）。

**改了什么**:

### Step 1 — DB 权威源收敛
- `work-one/.opencode/.trash-db/README.md`（新建）— 声明权威 DB 仅 `.opencode/state/framework-state.db`（schema v37）；列举 7 个惰性归档副本（`command-tools-copy-688k.db` 等）；规定统计/迁移脚本必须排除 `.trash-db/`；清理策略 stop-write→shadow-read→delete。

### Step 3 — 统一 JSONL 审计 + guidance 落盘
- 根因：`jsonl-writer.ts` 支持 `guidance` channel（line 18: `guidance: "guidance.jsonl"`），但**无调用方** invoke `writeJsonl("guidance", ...)` → `guidance.jsonl` 从不生成。
- `work-one/.opencode/plugin-handlers/system/anti-bypass.ts` 加 `import { writeJsonl } from "../../lib/jsonl-writer";`，并在 3 个 guidance 生命周期事件各加 1 个 emitter:
  - L61 `STOP-INJECTED`（softThreshold STOP 注入）
  - L118 `PHASE1-DIRECTIVE-INJECTED`（guidance gate 激活，要求 agent 调 question）
  - L147 `PHASE2-DIRECTIVE-INJECTED`（QoderWork 已下发指导，注入 recovery）
  - `bun build` 通过，3 emitter 已确认。
- 现在 4 类 JSONL（audit/quality/skill/guidance）全部有产生方；qoder-watcher.ts (Phase 1 Step 7) 可消费完整 4 类。

### Step 5 — framework-maintenance Critical 边界矩阵
- 验证脚本 `p4-boundary-matrix.ts`（Windows temp，经 `wsl cp` 入 WSL 运行）:复制 live DB 到 `/tmp/fw-boundary-test.db`，设 `FRAMEWORK_DB_PATH` 指向副本，动态 import `framework-maintenance-plan.ts` + `db-manager.ts`（用 `getDb()` 共享连接），跑 8 个用例。
- **结果 8/8 PASSED**：no grant→硬阻断；grant consumed→createPlan 阻断；grant expired→阻断；grant revoked→阻断；grant+plan+in-plan路径→写入 PASS；grant+plan+out-of-plan→阻断；complete then write→阻断；path outside allowlist→createPlan 阻断。
- 关键事实：`new Database(DB,{create:false})` 在 bun v1.3.14 报 `SQLITE_MISUSE` → 改用 `new Database(DB)`；边界判定逻辑 `createFrameworkMaintenancePlan`(L56-75) + `assertPathInActivePlan`(L145-173) 行为符合设计。

**决策**:
- Step 1 选"建 README 声明权威源"而非删归档文件——归档副本是历史回滚追溯资产，stop-write 即可，物理删除延后到 Deprecated 层统一清理。
- Step 5 用 temp-DB 副本隔离验证，避免污染 live 运行时 DB；`getDb()` 共享连接修复了第二连接不可见插入的假"Grant not found"。
- 被延后的方案:Step 2/4/6 的 live serve/proxy 验证（hot-path 只读工具不写 DB、/children fallback 故障注入、deprecated 表停写）需真实 serve session，并入统一 runtime smoke。

**Phase 4 完成度**: static 工作全完（Step 1/3/5 落地并验证）；Step 2/4/6 + Phase 1/2/3 遗留 runtime 尾巴待 serve session 闭环。

**关联**: grant `71820503-3417-49f4-a663-de1c8223f686` + plan `9e1139c1-db33-4904-a8ab-ef3392357fc5`（targetPaths: `.opencode/.trash-db/README.md` + `.opencode/plugin-handlers/system/anti-bypass.ts`）已 consumed/completed。
