# 执行报告：T-PT-003 / T-PT-004（REQ-PT-002 / ORA-PT-02）

**式样书**：`qoderwork/e2e/permission-template-enforcement-test-spec.md` v1.0.0
**执行入口**：隔离集成 harness（真实 `recordRead`+`verifyRead`+`attestSkillRead`）
**层级分列（§8.4）**：本报告仅记录 **deterministic-integration**；不含 component / runtime-smoke / live LLM E2E，不得互相升级为其他层结论。
**日期**：2026-07-14

## 0. 归因（§8.3 必填）

| 项 | 值 |
|---|---|
| work-one HEAD | `722017fe` |
| branch | `work-one` |
| 工作树状态 | `.opencode` 存在既有未提交改动（Orchestrator.md、agent-identity.ts 等）——**与本次执行无关**；harness 未触碰生产 DB/config |
| serve | PID 418455 运行中（本测试未经 serve，直接单元/集成调用真实服务函数） |
| DB 隔离 | `FRAMEWORK_DB_PATH=/tmp/pt-harness-<ts>/test.db`（`getDb()` 自动建全量 schema） |
| config 隔离 | `OPENCODE_ROOT=/tmp/pt-harness-<ts>/wt`，临时 `project.config.json` 的 `template_resolution.required_skill_reads=["preflight-lite","codegraph-first"]` |
| harness 源 | `/tmp/pt-harness-t003-t004.ts`（绝对路径 import 真实实现，无 mock 内部 helper） |
| 精确命令 | `cd work-one && bun /tmp/pt-harness-t003-t004.ts` |
| 原始产物 | `e2e-evidence/L3/permission-template-enforcement/t003-t004-attest-harness.json`、`.../t004-write-block-static-evidence.txt` |

## 1. T-PT-003（happy / integration）— **PASS**

- **agent / session**：`build` / `pt-t003-<ts>`
- **操作**：对两份 required skill（preflight-lite、codegraph-first）经真实 `recordRead` 记录完整读取（contentLength=fileSize、file_hash=当前 SHA-256），再调 `attestSkillRead({agent, sessionID, worktree, taskId:null})`。
- **ORA-PT-02 观察**：
  - `verified: true` ✓
  - `files_verified` 数 = 2，与 required list 一一对应 ✓（`one_to_one=true`）
  - `state_written: true`（skill_read_state 子状态写入）
- **判定**：**PASS**（认证契约完全满足）。

## 2. T-PT-004（negative / integration）— **认证契约半部 PASS；写阻断半部 FAIL（first-failure）**

- **agent / session**：`explore` / `pt-t004-<ts>`（换 agent 以隔离读历史——`attestSkillRead` 内 `verifyRead` 不按 session 过滤，仅按 agent+path+5min 窗）
- **操作**：仅记录 preflight-lite 的完整读取，故意不读 codegraph-first，再调 `attestSkillRead`。

### 2a. 认证契约半部（`verified:false` + unread_files）— PASS
- `verified: false` ✓
- `unread_files` = `[".../codegraph-first/skill.md"]`（恰为未读项）✓
- `hint` 给出明确补救（读完整文件后重跑）✓

### 2b. 写工具计数=0 半部 — **FAIL（当前活跃 runtime 不强制）**

ORA-PT-02 另一半要求"`verified:false` 时任何写工具调用数为 0"。静态证据表明**当前活跃 runtime 不提供该硬阻断**：

| 证据 | 结论 |
|---|---|
| `rule-disposition.ts:38` | `"checklist-incomplete": "audit_only"` → checklist 未过关只审计**不阻断** |
| `rule-disposition.ts:61` | `"config-attest-required": "audit_only"`；无任何 skill-attest 专属 `hard_block` 规则 |
| `plugin-handlers/before/phase0-enforce.ts:1-6` | 标注 `RETIRED-ROLLBACK — NOT in active execution_order`（旧的 initial_read 硬阻断已退役） |
| `service/gate/checklist-validate.ts:1-11` | 标注 `LEGACY — NOT in active execution_order`；"active checklist gating is now rule-disposition driven" |
| `skill-policy.ts:63-91` | 活跃链中写工具仅 `writeLog` WARN，**无 throw** |
| `project.config.json` | `safe_edit`/`safe_shell`/`safe_mkdir` 均在 `checklist_passthrough_tools` 直通名单 |
| 活跃 before 链 | `[gate-call-context, guidance-bridge, task, permission-safety, tool-governance, behavioral-path-guard, scope, path-validate, codegraph, skill-policy, dispatch-signal]`——无任何 handler 对"技能未认证"硬阻断写工具 |

- **判定**：T-PT-004 作为整体 oracle **未通过**。认证契约（返回值）符合预期，但式样书要求的"认证失败即写工具零执行"在当前配置下不成立（写工具会以 audit-only 放行，写计数 ≥ 1）。

## 3. 结论与移交

1. **T-PT-003 = PASS**；**T-PT-004 = FAIL（first-failure：写阻断半部）**。
2. **性质判断（需 reviewer 裁决）**：此 FAIL 反映"式样书期望行为（REQ-PT-002：失败时写工具未执行，源自 Blueprint 意图）"与"当前活跃 runtime 的刻意 audit-only 设计"之间的张力。二者必居其一为待办：
   - 选项 A：这是 Blueprint P1 尚未实现的强制项 → 属 Phase 1/2 代码工作范畴（须先解除 §8.1 gate 且经 reviewer 批准）。
   - 选项 B：audit-only 是刻意的行为型信号设计（见 skill-policy.ts 头注"only warn for write tools"）→ 则式样书 ORA-PT-02 的"写计数=0"与实现设计不一致，应由 reviewer 校准式样书或 Blueprint。
3. **§8.1 gate 状态**：T-PT-001/002/003/005 已具备通过证据；**T-PT-004 未通过**。按 §8.1"任一 BLOCKED/INVALID 未解除，不得执行或修改 Phase 1/2 代码"，**不得**进入 §8.2 的 T-PT-006+ 或任何代码修改，直至 reviewer 就本 first-failure 作出裁决。
4. **未越范围**：本次未实施任何生产代码/配置改动（式样书 §1"明确不在范围"）；未真实 remote write；未经 serve/live session。
