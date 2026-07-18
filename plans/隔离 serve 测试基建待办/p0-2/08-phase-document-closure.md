# Phase PHASE-08: evidence-qualified P0-2 document closure `[OBSERVATION]`

**Phase ID**: `PHASE-08`
**Depends on**: PHASE-07
**Outcome**: 仅用实际双 run 证据更新 Blueprint、待办、skills、日志和索引。
**Evidence level**: manual verification

## Goal

- 关闭文档状态，不修改代码；任何缺失证据均保持 P0-2 非 DONE。
- 对证据缺失或目标不存在的陈述固定使用 `FOUND`、`NOT_FOUND`、`UNAVAILABLE`；不可读证据为 `UNAVAILABLE`。

## Starting state and dependency

- PHASE-07 completion gate 必须通过；两组 runtime run IDs 和 artifacts 必须可读。
- 当前 P0-2 不具备 closure 证据，故本 Phase 保持 blocked。

## Local requirements

| Requirement | Condition | Required behavior | Observable result |
|---|---|---|---|
| REQ-001 | skill copies | 四份内容一致 | SHA-256 相同 |
| REQ-002 | Blueprint/backlog | 引用实际 run IDs | 不夸大证据层级 |
| REQ-003 | closure log/index | 记录准确变更 | 可追溯文档路径 |

## Allowed files

| Exact path | Change | Exact symbol/anchor |
|---|---|---|
| `blueprints/blueprint-isolated-serve-test-infrastructure.md` | modify after proof | §5.2 evidence | runtime status |
| `logs/2026-07-16-隔离-serve-测试基建待办.md` | modify after proof | P0-2 item | status |
| `.agents/.qoder/.trae/.workbuddy` isolated-serve skills | modify after proof | P0-2 procedure | copy parity |
| `documents/INDEX.md` | modify only if Blueprint changes | Blueprint entry | index sync |
| `logs/YYYY-MM-DD-p0-2-closure.md` | add | closure log | handoff |

## Forbidden files and behaviors

- 不因计划完成、component PASS 或单组 runtime 成功写 `DONE`。
- 不重写无关 INDEX 条目；不伪造 run ID、hash、artifact path。

## Fixed contract

- 四份 skill/reference 以 SHA-256 完全相同为 PASS。
- Blueprint/backlog/index 仅写入 PHASE-05 和 PHASE-06 的真实 run IDs、ports、manifest、stage results、cleanup reports。
- closure log 不超过 20 行，列出代码、测试、skills、Blueprint、待办、计划和 INDEX 更新。

## Implementation steps

```text
1. 读取两组 runtime artifact 并提取 run IDs/paths。
2. 更新四份 skill/reference 并比较 SHA-256。
3. 更新 Blueprint、待办和 P0-2 index 的证据状态。
4. 创建 closure log；若 Blueprint 改动则更新 documents/INDEX.md。
5. 重跑 diff check、hash 和文档命令对照。
```

## Check Registry

| Check name | Source of truth | Read/operation | PASS | Missing/corrupt behavior | Exact failure result |
|---|---|---|---|---|---|
| `runtimeEvidenceReadable` | A/B artifacts | parse manifests/stages/reports | both runs readable | one absent | `runtimeEvidenceReadable` |
| `skillCopyParity` | four copies | SHA-256 compare | identical | mismatch/missing | `skillCopyParity` |
| `statusEvidenceQualified` | docs | inspect status claims | exact level | unsupported claim | `statusEvidenceQualified` |
| `indexScope` | documents index | targeted diff | only Blueprint entry | unrelated rewrite | `indexScope` |

## All-pass Fixture

| Evidence object | Creation method | Required fields/data | Why required |
|---|---|---|---|
| two runtime packets | PHASE-05/06 | run IDs and artifacts | closure basis |
| four skill copies | synchronized files | equal SHA-256 | procedure parity |
| targeted document diff | edits after proof | expected paths only | drift control |

## Single-failure Matrix

| Test ID | Baseline | Only mutation | Expected check | Exact failedChecks/error | Other checks |
|---|---|---|---|---|---|
| P02-D-RUN | complete packets | remove one cleanup report | `runtimeEvidenceReadable` | singleton | no DONE |
| P02-D-HASH | equal copies | change one copy | `skillCopyParity` | singleton | no DONE |
| P02-D-STATUS | qualified docs | claim runtime from component | `statusEvidenceQualified` | singleton | no DONE |

## Fixed verification

```bash
cd /home/zhaoge/workspace/qoderwork
git diff --check
sha256sum .agents/skills/isolated-serve-test/SKILL.md .qoder/skills/isolated-serve-test/SKILL.md .trae/skills/isolated-serve-test/SKILL.md .workbuddy/skills/isolated-serve-test/SKILL.md
```

- Required output/artifacts: two run packets, hash output, scoped diff and closure log.
- On non-zero/missing evidence: `BLOCKED`; leave P0-2 non-DONE.

## Rollback/failure convergence

1. Revert unsupported documentation claims only.
2. Retain real runtime evidence and prior truthful status.

## Phase completion gate

- [ ] PHASE-07 evidence is attached
- [ ] two runtime packets are readable
- [ ] four skill/reference copies hash-identical
- [ ] documentation claims match evidence levels
- [ ] P0-2 may be marked DONE only after every box is checked
