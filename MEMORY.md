# QoderCN Memory

精炼的长期参考知识。写"结论"不写"过程"。

## work-one 架构: OpenCode 平台扫描路径（2026-07-08 二进制 strings 验证）

| 类型 | 项目级（CWD） | 用户级 | 发现方式 |
|------|--------------|--------|---------|
| Skill | `.opencode/skills/<name>/SKILL.md` | `~/.agents/skills/`、`~/.claude/skills/` | 目录扫描自动发现 |
| Agent | `.opencode/agent(s)/<name>.md`（单复数两种都支持） | — | 目录扫描自动发现 |
| Command | `.opencode/command(s)/<name>.md` | — | 目录扫描自动发现 |
| Plugin | `.opencode/plugins/*.ts` | — | **半自动**：需在 `opencode.json` 的 `plugin` 数组显式声明路径 |
| MCP | 无文件扫描 | — | 纯配置：`opencode.json` 的 `mcp` 对象 |
| Tool | `.opencode/tools/*.ts` | — | 由 plugin 注册加载 |

## work-one 架构: opencode.json 配置键名与实际 agent 数

- 顶层键是**单数**：`plugin`（路径数组）、`agent`（对象）、`mcp`（对象）。AGENTS.md 旧版写的 `plugins`/`agents` 不准确，已校准。
- **实际运行 5 个 agent**：Orchestrator（自定义）+ build/general/plan/explore（native，无 .md）。设计蓝图的"10 角色"（Architect/Coder-BE/Coder-FE/Guardian/Arbiter/CI-CD/Super-Admin/Knowledge-Curator/Meta-Planner）**未在 opencode.json 注册**，仅存在于文档和 Orchestrator prompt 文本中。
- 判断 work-one 当前能力时，以 `opencode.json` 实测为准，不以文档描述的"三层十角色"为准。

## work-one 规则: 不确定时禁止下确定性结论

当对某个事实不确定时，必须先彻底排查（搜索所有可能的路径/配置），再给出结论。不要在排查不充分的情况下说"没有"或"不存在"。本次会话连续犯了 4 个错误（混淆身份路径、错误否定 Skill 扫描路径、搜错目录名、遗漏明显目标），全部源于此问题。

## work-one 约定: QoderCN 目录命名区分

- 用户级配置目录：`~/.qoder-cn/`（带 `-cn` 后缀）
- 项目级配置目录：`.qoder/`（不带后缀，与 QoderCLI 相同）
- 项目级 Skill 路径：`.qoder/skills/{name}/SKILL.md`
- 不要把两者命名搞混

## work-one 约定: QoderCN Skill 扫描路径

| 级别 | 路径 | 说明 |
|------|------|------|
| 内置 | 平台自带（11 个） | simplify, security-review, quest 等 |
| 用户级 | `~/.qoder-cn/skills/` | 当前不存在，需手动创建 |
| 项目级 | `.qoder/skills/` | 活跃，21 个 Skill + 12 个 .merged 备份 |

## work-one 规则: P0-2 隔离 serve 测试基建已完成（2026-07-22）

P0-2 plan 全部 8 phase（含 04a/06a）ACCEPT/DONE。关键事实：
- **test-serve CLI** 位于 `scripts/test-serve/isolated-serve.ts`，支持 `create/start/bootstrap/execute/verify/stop/cleanup` 完整生命周期
- **双 run 隔离** 经两组独立端口验证：PHASE-05（4001/4002）+ PHASE-06（4003/4004），16 stages all ok
- **runtime 证据** 位于 `~/.local/state/qoderwork/qoderwork/test-runs/`，含 manifest/stage-results/cleanup-report/sentinel-marker
- **4 份 skill 副本**（.agents/.qoder/.trae/.workbuddy）SHA-256 一致（d333c99a...）
- **审计链**：`audits/p0-2/` 含完整 scope-lock + EV receipts + validate-audit 记录，LATEST.md 指向 PHASE-08 ACCEPT
- **typecheck** 已 exit 0（33 errors 修复于 2026-07-22，commit 757b5f6 + 9c6011d9）
- **P0-1**（bootstrap-child-grant-fail-closed）尚未启动，是同族 plan 的下一步

## qoderwork 架构: v3 审计治理生效（2026-07-28）

- **审计链 v3 schema**：原 `boundary-contract/v1` 已迁移至 `audit-boundary-matrix/v3`，原 `v2.1-required` 已升级为 `v3-required`（见 `phase-04-scope-lock.yaml` / `phase-05-scope-lock.yaml`）。所有未来 plan 使用 `v3-required` / `component-only` 二选一。
- **共享 v3 parser**：`scripts/lib/audit-governance-schema-v3.ts`（hash `37b74a62...`，多 Phase 未变）是 v3 audit chain 单一权威 parser，禁止修改。
- **ACCEPT 签发机制**：v3 ACCEPT 必须通过 `finalize-audit.ts` 原子发布 `audit-governance-latest/v3::latest-pointer`（CAS temp+rename，fail-closed）。**CLI 默认 validate 与 JSON report 契约不一致**（CLI 强制走 `validateAuditFile` 验 markdown，函数要 JSON），需用 `bun -e` + stub validator 绕过（与 `finalize-audit.test.ts` 模式一致）。
- **`.contract.json` vs `audit-report.json` 区分**：`audit-governance-audit/v3::audit-contract` 是 markdown 报告（含 `<!-- AUDIT_CONTRACT_START -->` JSON block）；`audit-governance-report/v3::audit-report` 是 finalize-audit.ts 发布的 hash-stable JSON wrapper。两者 schema 不同，bindings 不同。
- **`stableStringify` 子对象排序 bug**：`finalize-audit.ts` 的 `stableStringify` 仅对顶层 keys 排序，对嵌套对象不排序，导致 `settles:{}`。建议用 Python `json.dumps(..., sort_keys=True)` 替代生成 audit-report.json。
- **provenance 规则正本**：`.agents/skills/plan-audit-archiver/provenance-rules.md`（P-01~P-07 唯一正本），AGENTS.md §15 仅存规则索引。`v2.1` 字面在文档中保留作为历史引用，但实际生效集合为 `{v3-required, component-only}`。

## qoderwork 规则: `validate-phase-progression.ts` 状态机契约（2026-07-28 踩坑）

- **合法状态集合**：`NOT_STARTED / IN_PROGRESS / ACCEPTED / BLOCKED / INVALID`（`DONE` 和 `IMPLEMENTED` 故意不被接受）。
- **`ACCEPTED` 前置**：checked completion gate + readable completion receipt（hash 绑定）。
- **顶层 `**Status**` 派生**：`COMPLETE`（全 ACCEPTED）/ `IN-PROGRESS`（任一）/ `BLOCKED`（任一 BLOCKED/INVALID）/ `READY-FOR-IMPLEMENTATION`（其他）。顶层声明必须与派生一致（`TOP_LEVEL_STATUS_MISMATCH`）。
- **target phase 必须 `NOT_STARTED`**（`NEXT_PHASE_STATE_INVALID` 规则）。`validate-phase-progression.ts PHASE-01` 默认走 target=PHASE-01（NONE dep），exit 0 通过条件最弱。
- **Plan-index 不可强塞"实施完成"事实**：plan-index 是 progression 状态机，记录"接下来做什么"，不是事实归档。"实施完成"事实由 scope-lock/impl-verification/audit chain 管理，不由 plan-index 管理。
