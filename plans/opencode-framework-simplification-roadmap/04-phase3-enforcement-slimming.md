# Phase 3: Enforcement 热路径瘦身

> **版本**: 2.1.3  
> **日期**: 2026-07-23  
> **目标**: Enforcement 从身份绑定转为行为治理；安全 hard block，质量 warn/audit，QoderWork 可介入。

---

## 0. Live 审核状态（2026-07-11）

**结论**: active enforcement 已转向 rule disposition + behavior-based hard block；`tool-governance` 已接入 before 热路径；legacy hard-block handler 已退出 active order。Tool Governance 收缩已闭合（`codegraph.ts` repo-op 主裁决已移入治理域，见 tool-governance 行）。**A2 核查（2026-07-11）：active before 链（DEFAULT_ORDER 11 handler，含 `path-validate`）全部通过 `resolveAgent()` 泛型寻址，无按旧角色名（@Super-Admin/@Coder-BE 等）硬编码的 per-agent caller；旧角色名仅存于 `project.config.json`、legacy service、`docs/`、注释（符合路线图「旧角色名只用于 legacy profile/日志/审计」原则）→ A2 条件未触发，无需代码改动，仅文档化。** **2026-07-13 修正**：A2 仅覆盖 before-dispatcher handler 层；`lib/agent-identity.ts` `DISPLAY_NAMES` 的 `plan: "Meta-Planner"` 是权限解析层（`getAgentPermission` 经 `toDisplayName`）的 active 旧角色身份绑定，A2 漏检。该映射导致 plan agent 权限走 `LEGACY_AGENT_PERMISSIONS["Meta-Planner"]` fallback、opencode.json plan 配置被忽略（见 blueprint 修订日志 2026-07-13），列为 P0 修复。**2026-07-23 交叉审核确认已修复**：`DISPLAY_NAMES` 无 `plan` key，`toDisplayName("plan")="plan"`，`getAgentPermission("plan").safe_shell="deny"` 正确命中 opencode.json。

| 检查项 | 状态 | 证据等级 | 证据 |
|---|---|---|---|
| mode compat | ✅ active runtime 已迁移 | static/code | active plugins/handlers 不调用 `getEnforcementMode()`；仅 compat shim/export 残留 |
| dispatcher map/order | ✅ 完成 | static/code | before 11 / after 7 / system 2 与 dispatcher map 对齐 |
| legacy hard-block handler | ✅ 完成 | static/code | 多个 legacy 文件头 `NOT in active execution_order`；active order 不含旧 handler |
| question full-runtime | ✅ 完成 | runtime smoke | runtime smoke T5 |
| framework maintenance gate | ✅ 主链路 + 组件矩阵通过 | component + runtime smoke | `framework-maintenance.test.ts` 13/13 PASS；runtime smoke T6 |
| tool-governance MVC | ✅ 收缩已闭合 | component + static/code + unit + runtime log smoke | `tool-governance` before handler 已进入 active order（before 末位）；repo-policy 覆盖 github read/write + shell repo-op（30/30 PASS）；`codegraph.ts` 已移除 repo-op/GitHub write 主裁决（仅留证据适配器）；`controller` 新增 `allow` outcome 日志（REPO-OP@repo-policy）；新增 handler 单测 2/2 + codegraph 委让单测 5/5；`path-policy.ts` 的 protected-read 正则回归已修复，`safe_shell cat .opencode/service/repo/classify.ts` direct smoke 返回 allow；D3 日志 smoke（SID=D3-live-*）：github read→`GOVERNANCE-ALLOW ruleId=REPO-OP@repo-policy`，github write→`GOVERNANCE-BLOCK ruleId=REPO-OP layer=repo-policy outcome=deny`，日志落 `plugin-tool-governance-runtime.log` + `audit.jsonl` |
| A2 旧 per-agent caller | ✅ N/A（条件未触发） | static/code | `before-dispatcher.ts` DEFAULT_ORDER 11 handler 均经 `resolveAgent()` 泛型寻址，无旧角色名硬编码 caller；旧角色名仅存 config/legacy-service/docs/注释（grep 全量确认） |
| per-agent 检查层 | 🟡 部分完成 | static/code + component + **bun 实测** | `isWriteAllowed` 零 runtime caller（dead，2026-07-13 复核：`executeWriteAuditCheck` 无 caller，仅 barrel re-export）；`getAgentShellAllowlist` 仍被 `shell-config`/`shell-guard` 使用；旧角色 safe-bash 期望已改为 5-agent 边界，`safe-bash-core.test.ts` 23/23 PASS；**2026-07-13 发现 `agent-identity.ts` `plan: "Meta-Planner"` 映射使 plan agent 权限错误走 legacy fallback（bun 实测：safe_shell 配置 deny 实际 allow-all），证明 `getAgentPermission` 仍在 active 路径生效，P0 修复待执行~~ **已修复（2026-07-23 交叉审核：`toDisplayName("plan")="plan"`，`getAgentPermission("plan").safe_shell="deny"` 正确命中 opencode.json；`getAgentPermission` 仍在 active 路径生效，后续仍需迁移 caller 至行为型）** |

---

## 1. 当前执行链

| Phase | active order |
|---|---|
| before | gate-call-context, guidance-bridge, task, permission-safety, behavioral-path-guard, scope, path-validate, codegraph, skill-policy, dispatch-signal, tool-governance |
| after | gate-call-context, unified-audit, skill-audit, quality-contract, dispatch-trace, db-health, guidance-recovery |
| system | anti-bypass, skill-summary |

`gate-call-context` 是 v37 的 active 链路，必须排在 gate MCP 工具上下文捕获路径最前。

---

## 2. 固定 rule disposition

| 规则 | disposition |
|---|---|
| 原生 edit/bash | hard_block |
| dangerous shell | hard_block |
| backup bypass | hard_block |
| 写入路径越权 | hard_block |
| 源码修改前无 CodeGraph | hard_block |
| framework maintenance 无 grant | hard_block |
| framework maintenance 无 active plan | hard_block |
| framework maintenance 无 CodeGraph evidence | hard_block |
| grant path 越界、TTL 过期、budget exhausted | hard_block |
| guidance gate active 且工具不是 question/clear_guidance | hard_block |
| route mismatch | audit_only |
| checklist phase | audit_only |
| TDD 顺序 | audit_only |
| native Task 缺 token | audit_only |
| 任务匹配 Skill 未加载 | warn_continue |
| TodoWrite 缺失、停滞、错配 | warn_continue |
| freshness evidence 缺失 | warn_continue，生产安全破坏性任务由 hard rule 覆盖 |
| Scout-equivalent 未执行 | warn_continue |
| output contract 不完整 | warn_continue |

---

## 3. 固定实施步骤

### Step 1: 迁移 mode compat caller

运行：

```bash
cd /home/zhaoge/workspace/opencode/work-one
rg -n "getEnforcementMode|ENFORCEMENT_MODE|advisory|strict|locked" .opencode
```

实施动作：
1. active runtime caller 改为 `getRuleDisposition(ruleId)`。
2. 测试中的 `advisory/strict/locked` 改成具体 rule id。
3. 文档中的 mode 叙述改成 rule disposition 表。
4. `getEnforcementModeCompat()` 只留 legacy 注释和测试兼容，active path 不调用。

完成门槛：
- active service/plugin 不依赖 mode 判断阻断。
- 用户可见错误不出现 mode 名称。

### Step 2: 替换 per-agent 检查层

**P0 前置修复（已完成 2026-07-23）**：删除 `lib/agent-identity.ts` `DISPLAY_NAMES` 中的 `plan: "Meta-Planner"` 条目。修复后 `toDisplayName("plan")="plan"`，`getAgentPermission("plan")` 正确命中 opencode.json plan block（当前错误走 `LEGACY_AGENT_PERMISSIONS["Meta-Planner"]` fallback，导致 plan 的 `safe_shell` 配置 `deny` 实际生效 `{"*":"allow"}`）。验证：`bun -e` 确认 5 active agent 全部走 opencode.json；`safe-bash-core.test.ts` 23/23 仍 PASS。codegraph impact `toDisplayName`（13 caller）已确认 `agent-target.ts`/`router.ts:235`/`isDagExempt` 不受影响。详见 blueprint 2026-07-13 修订日志。**2026-07-23 交叉审核确认**：`DISPLAY_NAMES` 无 `plan` key，`toDisplayName("plan")="plan"`，`getAgentPermission("plan").safe_shell="deny"` 正确命中 opencode.json，bug 已消除。

按顺序处理：

1. `readDispatchAllowedTools`：保持 symbol 删除，清文档和测试引用。
2. `isWriteAllowed(agent,path)`：已 dead（零 runtime caller，仅 barrel re-export 待清理，2026-07-13 复核）。
3. `getAgentPermission(agent)`：只保留 legacy profile 审计读取，不参与 active block。
4. `getAgentShellAllowlist(agent)`：迁移到全局 shell policy 与 `opencode.json` permission。
5. `PermissionIsolation`：移到 legacy/export 测试区域，active path 不引用。
6. config-read-attest per-agent：改为 high-risk attestation，不按 agent `.md` 存在性阻断。

完成门槛：
- general/explore/build/plan 不因缺旧 agent profile 被三层阻断。
- scope、safe_shell、CodeGraph 仍能独立 hard block。

### Step 3: 清理 dispatcher 漂移

运行：

```bash
cd /home/zhaoge/workspace/opencode/work-one
python3 - <<'PY'
import json
p=json.load(open('.opencode/project.config.json'))['plugin_execution_order']
print('before', p['before'])
print('after', p['after'])
print('system', p['system'])
PY
rg -n "HANDLER_MAP|DEFAULT_ORDER|uc7ks|audit|gate-call-context" .opencode/plugins .opencode/plugin-handlers
```

实施动作：
1. active order 中的 handler 必须存在于 dispatcher `HANDLER_MAP`。
2. dispatcher import 中未运行的 handler 移到 legacy 注释区。
3. 文件头、注释、metrics 同步为 before 11 / after 7 / system 2。
4. after delegate 副作用写入 metrics：`unified-audit -> read-track/scope/codegraph`，`quality-contract -> format/tdd/TodoWrite`。

### Step 4: 隔离 legacy hard-block handler

处理对象：
- `before/phase0-enforce.ts`
- `before/checklist.ts`
- `before/dispatch.ts`
- `before/json-validate.ts`
- `before/uc7ks.ts`
- `service/dispatch/dispatch-validate.ts`
- `service/gate/checklist-validate.ts`

实施动作：
1. active order 不接入上述 handler。
2. 保留文件时添加 `Legacy handler, not active order` 文件头。
3. active docs 删除旧 initial_read/checklist/DAG hard-block 叙事。
4. 需要保留的检查改为 rule disposition 驱动。

### Step 5: 完成 Question full-runtime

固定测试流程：

1. 统一 E2E watcher 为 tail mode，规避 `SSEWatcherFd + fstatSync(fd)` 风险。
2. 创建 controlled failure session。
3. 制造 `failure_count >= soft_threshold`。
4. 捕获 `STOP-INJECTED`。
5. 调用 `question`。
6. 通过 `POST /question/{QID}/reply` 回复。
7. 捕获 `QUESTION-RECOVERY-COMPLETE`。
8. 查询 DB 确认 `failure_count` 清零。
9. 写入 guidance-delivered 证据。

完成门槛：
- STOP、question、reply、recovery、guidance 五段证据齐全。

### Step 6: 固化 framework maintenance grant gate

固定顺序：

1. Orchestrator dispatch 创建 `framework_maintenance` grant。
2. child build 运行 CodeGraph query/impact。
3. child build 调用 `framework_maintenance_plan`。
4. child build 调用 `safe_framework_edit`。
5. child build 调用 `framework_maintenance_complete`。

边界测试：
- 无 grant 写框架路径 -> hard block。
- 有 grant 无 plan -> hard block。
- 有 plan 无 CodeGraph evidence -> hard block。
- path 不在 plan -> hard block。
- path 不在 grant allowlist -> hard block。
- TTL 过期 -> hard block。
- write budget exhausted -> hard block。
- complete 后继续写 -> hard block。

---

## 4. Phase 3 完成门槛

- [x] active runtime 不按 advisory/strict/locked 分支。
- [ ] per-agent 检查层不参与 active hard block。（部分完成：旧写入 audit 为 audit_only；shell allowlist 仍按 agent permission 生效；**plan->Meta-Planner 映射 bug 已修复（2026-07-23 交叉审核确认），`getAgentPermission` 仍在 active 路径生效，仍需迁移 caller 至行为型**）
- [x] before 11 / after 7 / system 2 与 dispatcher map 一致。
- [x] legacy hard-block handler 不在 active order。
- [x] after delegate 副作用进入 metrics。
- [x] question full-runtime 五段证据齐全。
- [x] framework maintenance edge-case matrix 全部 hard block。
- [x] `safe_framework_edit` 无 active plan 时必定失败。
