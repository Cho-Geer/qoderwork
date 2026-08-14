# Handoff — 2026-08-14 Task Lens M1 Completion v2: Validator CRLF Fix（Group D）

## 摘要

Group D（Wave 1, Agent A3）为 validator CRLF→LF 归一化缺口建立了**独立 plan 设计骨架**与交接材料，全程未触碰任何 `scripts/**` 代码（§5.1 禁令：本 plan 为设计骨架，validator 代码修改须在 plan 审批后由独立 session 实施）。根因：`scripts/lib/outcome-governance-v1.ts:102` 的 `sha256()` 不归一化，而 `scripts/validate-outcome-governance.ts:39-43` 的 `artifact()` 以归一化 `sha()`（CLI:22）比对通过但返回 raw bytes（CLI:43），CLI:251-253 将 raw bytes 喂给 lib 非归一化 `sha256()`（lib:163/189），导致 bundle 19 个源文件中 13 个 raw 与声明 LF sha 不一致（2026-08-14 独立复验：raw 6/19、LF 归一化 19/19），Windows Git Bash 实跑 EXIT=1（errors: BUNDLE TEST_BUNDLE_HASH_MISMATCH + SPEC SPEC_INVALID），WSL 预期 EXIT=0（main-session UNVERIFIED）。修复方案推荐 D-A（lib:102 `sha256()` 加 CRLF→LF 归一化），与 CLI `sha()` 既有语义对齐、幂等、不破坏现有 19/19 归一化声明；实施须先做 CodeGraph impact 分析并双端实跑验证。

## 关联文件

- **D1 plan 骨架**：`plans/task-lens-validator-crlf-fix/00-plan-index.md`（Plan ID: TASK-LENS-VALIDATOR-CRLF-FIX-20260814，Status: DRAFT，209 行）
- **v2 plan 交叉引用**：`plans/task-lens-m1-completion-v2/00-plan-index.md` §2.4 BLK-V2-002（2026-08-14 已加 cross-link）
- **v2 plan §2.4 原文（BLK-V2-002）**："gen2 outcome 目录骨架**已落盘**（原 blocker 解除）。gen2 文件落盘到 `plans/task-lens-outcome-v1/` 同目录，SHA 见 §0.3.1；validator 实跑 INVALID（数据层 OK，但 CLI line 252-253 sources 未归一化导致 structural 校验 fail — 与 SHA 漂移无关）。"
- 证据来源：v2 plan 头部 Status（:5）、§0.3.1（:59）、`99-final-verification.md:4`、`handoff/2026-08-08-task-lens-m1-completion-v2-phase08-session2-handoff.md:74`（链重冻结采用行尾无关化哈希）

## 状态

- [x] 已创建独立 plan 骨架（DRAFT，未实施；不含 validator 代码修改）
- [x] v2 plan cross-link 已添加（§2.4 BLK-V2-002 段落之后）
- [ ] `scripts/**` 修复（等本 plan 审批 + 独立实施 session）
- [ ] 双端实跑验证（等实施后）

## 备注

本任务未创建 `logs/` 变更日志（协调契约未要求；plans/handoff 文档类变更）；如主会话要求，可在 Wave 1 收口时统一补记。R1/R2 复核重点建议：D1 skeleton 的根因行号引用、D-A/D-B/D-C 对比表完整性、v2 plan §2.4 编辑是否仅追加 cross-link 未改原文。
