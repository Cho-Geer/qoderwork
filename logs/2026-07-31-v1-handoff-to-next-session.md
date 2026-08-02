# v1 Admission Phase B/C Handoff — 新会话接手入口

> **创建时间**: 2026-07-31T08:11Z
> **会话**: check-plan（即将结束）
> **下一步会话**: <new session starting after restart>
> **作用域**: 把当前会话在 v1 admission Phase B/C 阶段的全部状态、决策、待批准产物、风险与执行清单移交，避免下一会话重复探索

## 1. 任务上下文（30 秒读完）

### 1.1 目标

`plans/audit-governance-recovery-v1/` 走 r5 admission 流程（canonical creation_order L1575-1586 的 11 步）。本会话已执行 Phase A（8 步制品生成），当前停留在 Phase B（HUMAN_USER 决策），下一步执行 Phase C（materialization_commands）。

### 1.2 当前状态（一句话）

7/7 r5 源制品已生成 + hash 链自洽 + 子 agent 复审草案 v2 = ACCEPT + 等用户批准写 `approval-decision-r5.json`。

### 1.3 关键事实速查（cheap verification 即可恢复）

| 事实 | 值 | 验证命令 |
|---|---|---|
| 工作区 | `/home/zhaoge/workspace/qoderwork/.worktrees/check-plan/` | `pwd` |
| worktree `audit-governance-recovery-v1-bootstrap` | **ABSENT**（必须保持） | `test -e .worktrees/audit-governance-recovery-v1-bootstrap; echo $?` 期望 1 |
| 87 m1 文件 | **87 = 7 plans + 80 audits** | `find plans/path-dynamic-resolution-m1/ audits/path-dynamic-resolution-m1/ -type f \| wc -l` |
| 7 r5 源制品 | **PRESENT** | `ls audits/audit-governance-recovery-v1/{*.json,*.sha256,bootstrap/*.json,bootstrap/*.md}` |
| `approval-decision-r5.json` | **ABSENT**（HARD STOP 守约） | `test -f audits/audit-governance-recovery-v1/approval-decision-r5.json` 期望 1 |

## 2. 已完成 Phase A — 7 个 r5 制品（hash 快照）

> **重要**：下一会话接手 Phase B/C 前，应**重新 sha256sum 7 文件**（防止本会话结束后被外部修改 → 防止 hash drift）。下表是本会话 2026-07-31T08:11Z 实测值，作为参照基准。

| 文件 | sha256 | 大小 |
|---|---|---|
| `plans/audit-governance-recovery-v1/canonical-requirements-contract.yaml` | `8e7b62d60f031257e364901c90ec9a4400a3fa90b7363c4592c24d1fe27f8236` | — |
| `audits/audit-governance-recovery-v1/approved-plan-object-set-r5.json` | `b5f7ac92b1d1d8a7f907d3be04828e07c3f8c1c2391f171a66fc55dc110ef9ad` | 3517 B |
| `audits/audit-governance-recovery-v1/approved-plan-files-r5.sha256` | `7ed684fefa2f914bb69356d9ae92751d862c446eefdceeda7b48c87cc043a2a9` | 135 B |
| `audits/audit-governance-recovery-v1/bootstrap/approved-index-baseline-r5.md` | `ac0a00db2c2edc5a35c228749dddd6197b6ea23bfe4151323bee225284ff016e` | 12326 B |
| `audits/audit-governance-recovery-v1/bootstrap/m1-p0-freeze-manifest-r5.json` | `f12f41f7fc7fb983758ef889ae0e275aa7b9f24588cd2f8efe32c060031daaaf` | 33427 B |
| `audits/audit-governance-recovery-v1/bootstrap/p4-boundary-r5.json` | `cbfd7864cb57946bdf78ec88e0be6e57e2e506d5ad2674ed40232c56a262adef` | 556 B |
| `audits/audit-governance-recovery-v1/approval-request-r5.json` | `5d9c14462402043b0b9d2dc58aa6c8e4931fb5785226df28e6d3bbaceb875074` | 5954 B |
| `audits/audit-governance-recovery-v1/approval-decision-pending-r5.json` | `1409b74265b1d150d84807e180212463d424f5f003e0a7d52afe4e609d56cd62` | 1203 B |

**`approval_request.sha256` 字段值** = `5d9c14462402043b0b9d2dc58aa6c8e4931fb5785226df28e6d3bbaceb875074`（即 approval-request-r5.json 自身 sha256）

## 3. Phase B 任务 — 写 approval-decision-r5.json

### 3.1 写盘前必验证（recommended sequence）

```bash
cd /home/zhaoge/workspace/qoderwork/.worktrees/check-plan
# 1. 7 r5 源文件批次 sha256 重算（防止 drift）
for f in approved-plan-object-set-r5.json approved-plan-files-r5.sha256 \
         bootstrap/approved-index-baseline-r5.md bootstrap/m1-p0-freeze-manifest-r5.json \
         bootstrap/p4-boundary-r5.json approval-request-r5.json \
         approval-decision-pending-r5.json; do
  sha256sum "audits/audit-governance-recovery-v1/$f"
done
# 2. 确认结果与第 2 节表一致（任何 hash 漂移则 STOP，调查漂移源）
# 3. 确认 approval-decision-r5.json 仍 ABSENT
test -f audits/audit-governance-recovery-v1/approval-decision-r5.json && echo "BAD: already exists" || echo "OK: not yet written"
```

### 3.2 写盘内容（草案 v2，已被 high-precision 子 agent 复审 = ACCEPT）

```json
{
  "schema_version": "audit-governance-approval/v3",
  "document_kind": "approval-decision",
  "decision_id": "AUDIT-GOVERNANCE-RECOVERY-V1-R5-APPROVED-20260731",
  "plan_id": "AUDIT-GOVERNANCE-RECOVERY-V1-20260730",
  "governance_profile": "audit-governance-recovery/v1",
  "decision": "APPROVED",
  "approved_by": "HUMAN_USER",
  "approved_at": "<UTC ISO8601, e.g., 2026-07-31T08:11:14Z>",
  "approval_request": {
    "path": "audits/audit-governance-recovery-v1/approval-request-r5.json",
    "sha256": "5d9c14462402043b0b9d2dc58aa6c8e4931fb5785226df28e6d3bbaceb875074"
  },
  "approved_artifacts": {
    "canonical_contract": {
      "path": "plans/audit-governance-recovery-v1/canonical-requirements-contract.yaml",
      "sha256": "8e7b62d60f031257e364901c90ec9a4400a3fa90b7363c4592c24d1fe27f8236"
    },
    "approved_plan_object_set": {
      "path": "audits/audit-governance-recovery-v1/approved-plan-object-set-r5.json",
      "sha256": "b5f7ac92b1d1d8a7f907d3be04828e07c3f8c1c2391f171a66fc55dc110ef9ad"
    },
    "approved_plan_files": {
      "path": "audits/audit-governance-recovery-v1/approved-plan-files-r5.sha256",
      "sha256": "7ed684fefa2f914bb69356d9ae92751d862c446eefdceeda7b48c87cc043a2a9"
    },
    "approved_index_baseline": {
      "path": "audits/audit-governance-recovery-v1/bootstrap/approved-index-baseline-r5.md",
      "sha256": "ac0a00db2c2edc5a35c228749dddd6197b6ea23bfe4151323bee225284ff016e"
    },
    "frozen_m1_files": {
      "path": "audits/audit-governance-recovery-v1/bootstrap/m1-p0-freeze-manifest-r5.json",
      "sha256": "f12f41f7fc7fb983758ef889ae0e275aa7b9f24588cd2f8efe32c060031daaaf"
    },
    "p4_boundary": {
      "path": "audits/audit-governance-recovery-v1/bootstrap/p4-boundary-r5.json",
      "sha256": "cbfd7864cb57946bdf78ec88e0be6e57e2e506d5ad2674ed40232c56a262adef"
    }
  },
  "exact_waiver_ids": [
    "PHASE-01_P02A_ENTRY_WHILE_INDEX_BLOCKED",
    "EXTERNAL_HUMAN_DECISION_FOR_PENDING_IMMUTABLE_LOCK",
    "SUPPLEMENTAL_QODERWORK_BASELINE_WITH_WORK_ONE_P07_ANCHOR",
    "CANDIDATE_BOOTSTRAP_ACTIVATION_AND_CLOSE_AFTER_VALID_AUDIT"
  ],
  "cryptographic_references": [],
  "effect": "AUTHORIZES_MATERIALIZATION_AND_PHASE_01_BOOTSTRAP",
  "immutable": true,
  "supersedes": "AUDIT-GOVERNANCE-RECOVERY-V1-R5-PENDING-20260731",
  "acyclicity_note": "This r5 APPROVED decision intentionally does not reference the materialization receipt. Per canonical L1603, the materialization receipt cannot be in its own approval chain; per canonical L1628, the immutable HUMAN decision binds the request hash after the request exists. The pending-r5 marker (which this decision supersedes) has empty approved_artifacts and no path/SHA references, so no cycle is introduced.",
  "approval_effect": "A HUMAN_USER approval authorizes only the exact artifacts and bootstrap boundary in this request. Any semantic plan-file change requires a new approval request and decision."
}
```

### 3.3 写盘后必验证

```bash
# 1. JSON 合法性
python3 -c "import json; json.load(open('audits/audit-governance-recovery-v1/approval-decision-r5.json'))" && echo "OK"
# 2. 哈希链自洽
sha256sum audits/audit-governance-recovery-v1/approval-decision-r5.json
# 3. 字段对照 (5 must-fix 全部修复)
python3 -c "
import json
d = json.load(open('audits/audit-governance-recovery-v1/approval-decision-r5.json'))
checks = {
  'decision = APPROVED': d['decision'] == 'APPROVED',
  'approved_by = HUMAN_USER': d['approved_by'] == 'HUMAN_USER',
  'no on_human_approval block': 'on_human_approval' not in d,
  'supersedes = R5-PENDING': d['supersedes'] == 'AUDIT-GOVERNANCE-RECOVERY-V1-R5-PENDING-20260731',
  'approval_request.sha256 = 5d9c1446...': d['approval_request']['sha256'] == '5d9c14462402043b0b9d2dc58aa6c8e4931fb5785226df28e6d3bbaceb875074',
  'approved_at is real timestamp': d['approved_at'].startswith('2026-') and 'Z' in d['approved_at'],
  'exact_waiver_ids length=4': len(d['exact_waiver_ids']) == 4,
  'cryptographic_references empty': d['cryptographic_references'] == []
}
for k, v in checks.items(): print(f'  [{(\"PASS\" if v else \"FAIL\")}] {k}')
"
```

## 4. Phase C 任务 — 执行 materialization_commands

### 4.1 命令（来自 canonical L1631-1658）

```bash
cd /home/zhaoge/workspace/qoderwork/.worktrees/check-plan
export AUDIT_RECOVERY_SOURCE_ROOT=/home/zhaoge/workspace/qoderwork/.worktrees/check-plan
export AUDIT_RECOVERY_TARGET_ROOT=/home/zhaoge/workspace/qoderwork/.worktrees/audit-governance-recovery-v1-bootstrap
export AUDIT_RECOVERY_IMMUTABLE_ROOT="$AUDIT_RECOVERY_TARGET_ROOT/audits/audit-governance-recovery-v1/bootstrap/approved-plan-bytes-r4"
test ! -e "$AUDIT_RECOVERY_TARGET_ROOT"  # 必须 ABSENT
/home/zhaoge/.bun/bin/bun -e '<canonical L1636-1655 脚本原文>'
cd /home/zhaoge/workspace/qoderwork/.worktrees/audit-governance-recovery-v1-bootstrap
test -s audits/audit-governance-recovery-v1/bootstrap/approved-plan-materialization-r5.json
test "$(find plans/audit-governance-recovery-v1/formal-plan-set -maxdepth 1 -type f | wc -l)" -eq 8
```

**预期输出**：`{"ok":true,"materialization":"...","semantic_entries":8,"live_paths":9}`

### 4.2 materialization_commands L1642-1645 硬校验（必须在写盘前确认）

| 检查 | 内容 | 状态 |
|---|---|---|
| L1642 | `DP.decision==="APPROVED" && DP.approved_by==="HUMAN_USER"` | 子 agent 验证 PASS |
| L1643×5 | 5 个 binding 的 path + sha256 与对应文件一致 | 子 agent 验证 PASS（5/5） |
| L1644 | `approved-plan-files-r5.sha256` 内容 = `${object_set_sha}  ${object_set_path}\n` | 子 agent 验证 PASS |
| L1645 | object-set schema_version/entry_count/entries.length | 子 agent 验证 PASS（8/8/8） |
| L1646 | freeze-manifest schema_version/entry_count/entries.length | 子 agent 验证 PASS（87/87/87） |

## 5. 后续步骤（Phase D）— 仅在 Phase C 成功后

参见 `plans/audit-governance-recovery-v1/formal-plan-set/01-phase-foundation-kernel.md` 的 PHASE-01 实施步骤：
1. scope-lock.json（g001）生成 + HUMAN approval
2. capture-state.ts 生成 pre-change-work-one-PHASE-01.json
3. validate-phase-progression admission（exit 0）
4. PHASE-01 step 1-8 实施（修改 8 个 allowed files）
5. PHASE-01 Fixed verification
6. 独立 Auditor 跑 validate-audit.ts

## 6. 决策历史（避免下会话重复探索）

### 6.1 已完成的决策

1. **新路径 1（2026-07-31）合法**：撤销 status update + 修 base_commit `2a8b15a → 51d95db` + 删 worktree — 已全部执行完成（canonical L29/L1647 两处）
2. **Hook config sync WSL→Windows**（2026-07-31）：已同步 hooks 块（SessionStart 注入 AGENTS.md reminder）
3. **plan-text 是自洽的**（设计判断反转）：撤销 2026-07-30 gap analysis 的 "TOOLCHAIN_MISSING" 误判，PHASE-01 的 8 个 allowed files（含 foundation-kernel.test.ts 等）是 phase 实施产物，不是外部依赖
4. **PHASE-02..04 同样**：close-audit-phase.test.ts / artifact-reference-graph.ts / check-audit-governance-recovery-conformance.ts 都是 phase allowed-files
5. **3 must-fix 已修复**（草案 v2 vs 草案 v1）：supersedes 改 R5-PENDING、drop on_human_approval block、approved_at placeholder 待写时填
6. **2 should-fix 已应用**：approval_request.sha256 已计算（同 approval-request-r5.json sha256）、exact_waiver_ids 改为 canonical L1594-1598 顺序

### 6.2 已识别的历史误判（避免重蹈）

- **2026-07-30 gap analysis 的 7 个问题**：5 个误读（r3/r5 schema 未定义、3 套 sha256 冲突、audit dir 文件名未对齐、P-04 未定义 generation=1 起点、00-index §1.5 与 canonical 文件名错位），2 个部分成立
- **2026-07-31 reanalysis 的 4 个真问题**：全部误判（plan 是自包含的，6 个 MISSING 文件是 phase 实施产物）
- **"新路径1 步骤 5 admission 路径畅通"**：未跑最便宜验证（`test -f approval-decision-r5.json`）就下结论——已用本会话后续的实测纠正

### 6.3 子 agent 复审结果（2 轮）

- **第 1 轮**（agent_859ecadb-...，无 Bash）：VERDICT = REWORK（3 must-fix + 2 should-fix）
- **第 2 轮**（agent_7c11f316-...，有 Bash）：**VERDICT = ACCEPT**（全部 must-fix 验证修复 + L1642-1646 6 项 PASS + acyclic 验证 PASS + 无新 blocking defect）

## 7. 当前阻塞 + 决策点

### 7.1 阻塞

- **Phase B 写盘**需要用户明确确认（AGENTS.md §10.1：HUMAN_USER approval-decision 禁止 agent 自批准——本会话已得用户"代我创建草案"的授权，但写盘前仍需用户确认 approved_at + 一次性 commit 行为）

### 7.2 决策点（用户在主会话给出）

- (A) 批准写盘，approved_at 用当前 UTC（写盘时实测）—— 主会话 sha256sum 批次验证 + 写盘 + 独立验证 PASS 后输出
- (B) 批准写盘，approved_at 用 `<指定时间>` —— 用户给时间
- (C) 草案还要改某字段 —— 用户指出
- (D) 暂不写，用户手动生成

### 7.3 风险（subagent 标注 + main session 标注）

- **Risk C**：写盘前必须 sha256sum 7 源文件批次（防止 hash drift）
- **Risk D**：`approval-decision-r5.json` 写后不可改（materialization receipt 的 `plan_approval.sha256` 会绑定）
- **Risk F**：`<placeholder>` 直接写盘会让下游 ISO 解析失败

## 8. 主会话独立验收范围（handoff 后）

按 audit-separation SINGLE 兜底规则：下会话主会话在写盘后必须**独立复核**（不能 trust 写盘返回的成功），至少：

1. `sha256sum audits/audit-governance-recovery-v1/approval-decision-r5.json` 与 draft 第 2 节 hash 匹配
2. 8 项字段对照（草案 v2 必填字段）全部 PASS
3. `cat audits/audit-governance-recovery-v1/approval-decision-r5.json | python3 -m json.tool` 无格式错误

## 9. 文件位置速查

| 路径 | 角色 |
|---|---|
| `plans/audit-governance-recovery-v1/canonical-requirements-contract.yaml` | canonical 合约（1719 行） |
| `plans/audit-governance-recovery-v1/formal-plan-set/00-plan-index.md` | 00-index（含 admission state） |
| `plans/audit-governance-recovery-v1/formal-plan-set/01-phase-foundation-kernel.md` | PHASE-01 实施步骤 |
| `audits/audit-governance-recovery-v1/{7 r5 files}` | Phase A 产物 |
| `audits/audit-governance-recovery-v1/approval-decision-r5.json` | **Phase B 产物（待写）** |
| `logs/2026-07-31-v1-handoff-to-next-session.md` | **本文件** |
| `logs/2026-07-31-v1-toolchain-blocker-status-update.md` | 已被本会话撤销（不再准确） |
| `logs/2026-07-31-v1-self-contained-design-confirmation.md` | 设计判断反转记录 |
| `logs/2026-07-31-v1-plan-text-reanalysis.md` | 第二份分析（4 真问题均误判） |
| `logs/2026-07-30-v1-plan-text-systematic-gap-analysis.md` | 第一份分析（5 误读） |

## 10. 下会话启动 checklist

- [ ] 读本文件（handoff）
- [ ] 读 `plans/audit-governance-recovery-v1/canonical-requirements-contract.yaml` L1550-1660（materialization + creation_order）
- [ ] 重新 sha256sum 7 r5 源文件，与第 2 节对照
- [ ] 确认 `approval-decision-r5.json` 仍 ABSENT
- [ ] 确认 worktree `audit-governance-recovery-v1-bootstrap` 仍 ABSENT
- [ ] 按 §3 序列执行写盘
- [ ] 按 §3.3 独立验证
- [ ] 按 §4 序列执行 materialization_commands
- [ ] 汇报结果给用户
