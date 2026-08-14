# Task Lens Validator CRLF Fix — Separate Plan Skeleton

**Plan ID**: TASK-LENS-VALIDATOR-CRLF-FIX-20260814
**Status**: IMPLEMENTED（2026-08-14 Agent D1/Wave 4 实施完成；D-A 方案落地，Windows Git Bash 端验证通过 EXIT=0，WSL 端未实跑 UNVERIFIED；§6 实施结果）
**Parent plan**: plans/task-lens-m1-completion-v2/00-plan-index.md（仅以"参考资料"身份引用，不修改）
**Scope**: 修复 scripts/lib/outcome-governance-v1.ts:102 `sha256()` 和/或 scripts/validate-outcome-governance.ts:39-43 `artifact()` 的 CRLF→LF 归一化缺口。

> 本文件仅为**设计骨架（skeleton）**：描述根因、方案对比、验收标准与解耦边界，**不包含任何 validator 代码修改**。`scripts/**` 修改须在本 plan 审批通过后由独立 session 实施（AGENTS.md §4.0：禁止未经审批的代码变更）。

## 0. 背景与根因

引证来源：v2 plan 头部 Status 自述（`plans/task-lens-m1-completion-v2/00-plan-index.md:5`）、v2 plan §0.3.1（同文件 :59）、`plans/task-lens-m1-completion-v2/99-final-verification.md:4` Current status 自述、`handoff/2026-08-08-task-lens-m1-completion-v2-phase08-session2-handoff.md:74`，以及本 skeleton 写作时（2026-08-14）对源码与 bundle 的独立复核。

引证来源明细：

| 来源 | 位置 | 本 plan 使用的证据 |
|---|---|---|
| v2 plan 头部 Status | `plans/task-lens-m1-completion-v2/00-plan-index.md:5` | 2026-08-10 Windows Git Bash 实测自述、line 252-253 根因自述 |
| v2 plan §0.3.1 | 同文件 :59 | run-result 路径对照与根因表述（`5a2a1075…`） |
| v2 plan §2.4 BLK-V2-002 | 同文件 :162 | validator 实跑 INVALID 且与 SHA 漂移无关 |
| 99-final-verification | `plans/task-lens-m1-completion-v2/99-final-verification.md:4` | errors 数组原文（BUNDLE / SPEC 两条） |
| phase08 session2 handoff | `handoff/2026-08-08-task-lens-m1-completion-v2-phase08-session2-handoff.md:74` | 链重冻结采用"validator hash 行尾无关化" |
| 源码复核 | lib:102/163/168/189 + CLI:17-23/39-43/251-253 | 本 skeleton 写作时 Read 复核（2026-08-14） |
| 哈希复验 | bundle 19 个源文件 artifact | 2026-08-14 只读复验（§0.4） |

v2 plan 头部 Status 自述（:5）全文引证：

> "DRAFT（草稿/待审批；gen2 数据层已落盘（run-result-v2.json 13/13 case 数据层 PASS + 8 gen2 文件 SHA 归一化后一致）但 validator 实跑 `ok:false`/`lifecycle:INVALID`（BUNDLE_HASH_MISMATCH + SPEC_INVALID；2026-08-10 Windows Git Bash 实测：CLI line 252-253 sources 未做 CRLF→LF 归一化，导致 validateTestBundle line 163 sha256 不匹配，与 outcome 文件本身 SHA 漂移无关）；§6 phase manifest 已回退为 NOT_STARTED/BLOCKED/BLOCKED/BLOCKED；INDEX 同步 BLK-V2-001 待 §2.4 + §7 状态机要求 INDEX sync session）"

- `scripts/lib/outcome-governance-v1.ts:102` 的 `sha256()` 不归一化：

  ```typescript
  export const sha256 = (bytes: string | Uint8Array): string => createHash("sha256").update(bytes).digest("hex");
  ```

- `scripts/validate-outcome-governance.ts:17-23` 的 `sha()` 归一化（但只用于 CLI 自身检查）：

  ```typescript
  const sha = (bytes: string | Uint8Array): string => {
    // Line-ending-insensitive hash: normalize CRLF to LF before hashing so a
    // chain frozen on a Windows checkout (CRLF) validates identically on a POSIX
    // checkout (LF). All hashed artifacts here are text (JSON/MD/test sources).
    const text = typeof bytes === "string" ? bytes : Buffer.from(bytes).toString("utf8");
    return createHash("sha256").update(text.replace(/\r\n/g, "\n"), "utf8").digest("hex");
  };
  ```

- `scripts/validate-outcome-governance.ts:39-43` 的 `artifact()` 返回 readFileSync raw bytes（含 CRLF）：

  ```typescript
  function artifact(root: string, value: ArtifactHash, errors: string[], label: string): Buffer | null {
    const path = safeBelow(root, value.path);
    try {
      if (!path || !statSync(path).isFile()) { errors.push(`${label}_MISSING_OR_ESCAPE:${value.path}`); return null; }
      const bytes = readFileSync(path); if (sha(bytes) !== value.sha256) errors.push(`${label}_HASH_MISMATCH:${value.path}`); return bytes;
    } catch { errors.push(`${label}_MISSING_OR_ESCAPE:${value.path}`); return null; }
  }
  ```

  注意：`artifact()` 的比对用归一化 `sha()`（CLI:22 行的 `text.replace(/\r\n/g, "\n")`），但返回的是未归一化 raw bytes（CLI:43 `return bytes;`）。

- 坏链点：`scripts/validate-outcome-governance.ts:251-253` 将 raw bytes 直接喂给 lib 的非归一化 `sha256()`：

  ```typescript
  for (const source of [bundle.tests, bundle.fixtures, bundle.oracle_sources, bundle.runner_config, bundle.lockfiles].flat()) { const bytes = artifact(repository, source, errors, "SOURCE"); if (bytes) sources[source.path] = bytes; }
  const result = validateTestBundle(bundle, sources);
  ```

- `scripts/lib/outcome-governance-v1.ts:163+168`（bundle 级比对，非归一化 → TEST_BUNDLE_HASH_MISMATCH）：

  ```typescript
  const validSources = validArtifacts && allArtifacts.every((artifact) => sources[artifact.path] !== undefined && sha256(sources[artifact.path]!) === artifact.sha256);
  // ...
  || bundle.expected_test_count !== bundle.expected_test_ids.length || !validSources) return fail("TEST_BUNDLE_HASH_MISMATCH");
  ```

- `scripts/lib/outcome-governance-v1.ts:189`（spec 级 bundleBytes 比对，非归一化 → SPEC_INVALID）：

  ```typescript
  || !bundleBytes || sha256(bundleBytes) !== spec.test_bundle.sha256) return fail("SPEC_INVALID");
  ```

- bundle 19 源文件中有 13 个 raw 与声明 LF sha 不一致（main-session 实测；2026-08-14 本 skeleton 写作时独立复验，证据见下方"复验证据"）。
- validator 在 Windows Git Bash 上实跑 EXIT=1，errors: `[BUNDLE:TASK-LENS-TEST-BUNDLE-V2:TEST_BUNDLE_HASH_MISMATCH, SPEC:TASK-LENS-ACCEPTANCE-SPEC-V2:SPEC_INVALID]`（`99-final-verification.md:4` Current status 自述原文）。
- WSL 上因 LF native checkout 应返回 EXIT=0（main-session UNVERIFIED，未实跑）。

### 0.1 根因链条（数据流，从 CLI 到 lib）

1. CLI:252 对 bundle 5 组源文件（tests / fixtures / oracle_sources / runner_config / lockfiles）逐个调用 `artifact(repository, source, errors, "SOURCE")`。
2. CLI:39-43 `artifact()` 以归一化 `sha()`（CLI:22）比对通过，但返回 raw bytes（CLI:43 `return bytes;`）——比对与返回使用不同字节。
3. CLI:252-253 将 raw bytes 装入 `sources` 并传给 `validateTestBundle(bundle, sources)`。
4. lib:163 用非归一化 `sha256()`（lib:102）对 raw bytes（含 CRLF）再哈希，与声明 LF 归一化 sha 不匹配 → lib:168 `fail("TEST_BUNDLE_HASH_MISMATCH")`。
5. lib:189 对 `bundleBytes`（bundle JSON 文件 raw 字节）同样非归一化比对 → `fail("SPEC_INVALID")`。
6. 根源：lib:102 `sha256()` 与 CLI:17-23 `sha()` 两个哈希入口并存且归一化行为不同；gen2 链声明 sha 是按"行尾无关化哈希"重冻结的（见 0.3 引文），lib 层却从未归一化。

### 0.2 双端预期对照

| 端 | checkout 换行符 | 现状预期 | 修复后预期 |
|---|---|---|---|
| WSL Ubuntu-24.04 | LF（native checkout） | EXIT=0（main-session UNVERIFIED，未实跑） | EXIT=0 |
| Windows Git Bash | CRLF（core.autocrlf 等） | EXIT=1（2026-08-10 实测 + 2026-08-14 复验 errors 同上） | EXIT=0 |

### 0.3 链重冻结引文（gen2 声明 sha 的语义来源）

> `handoff/2026-08-08-task-lens-m1-completion-v2-phase08-session2-handoff.md:74`："3. **CRLF 漂移修复**:validator hash 行尾无关化 + 链重冻结(用户授权);`frozen_diff` 新增 10 条 source-change + changed_fields 4→7 为哈希重算机械结果(Agent-D 已与 expectedFrozenDiff 算法对账)"

说明：gen2 链的声明 sha 是在"validator hash 行尾无关化"前提下重冻结的（与 CLI `sha()` 语义一致），而 lib `sha256()` 从未归一化——声明按 LF 语义冻结、校验按 raw 字节执行，二者错位即 13/19 raw 不一致的根源。

### 0.4 复验证据（2026-08-14，本 skeleton 写作时独立复验，只读哈希比对）

```
total: 19, rawMatch: 6, normMatch: 19, rawMismatch: 13, normMismatch: 0
sampleRawFail: scripts/task-lens/__tests__/input-diff.test.ts,
               scripts/task-lens/__tests__/command-security.test.ts,
               scripts/task-lens/__tests__/provider-graph.test.ts
```

即：19 个源文件 artifact 中 raw 字节 sha 仅 6/19 匹配，LF 归一化 sha 19/19 匹配（raw 不一致 13 个、归一化不一致 0 个），与 main-session 实测"13 个 raw 与声明 LF sha 不一致"一致。

## 1. 修复方案对比

| 方案 | 修改位置 | 影响面 | 风险 |
|---|---|---|---|
| D-A | lib:102 sha256() 加 CRLF→LF 归一化 | 所有 sha256 计算（影响所有 case verdict） | 低：归一化幂等，与 WSL 行为一致 |
| D-B | CLI:39-43 artifact() 返回前归一化 | 仅 CLI 的 artifact 路径 | 中：CLI 自身 sha() 已归一化但 artifact() 未；不同步修复导致双 sha 算法并存 |
| D-C | bundle 声明 sha 改为 raw（与 platform coupling） | 仅 spec/bundle；破坏 WSL/gitbash 双端一致性 | 高：WSL 端跑出会 FAIL |
| 推荐 D-A | — | — | — |

### 1.1 选择准则（为何推荐 D-A）

1. **单一哈希入口**：lib:102 是 lib 内唯一 `sha256` 实现，被 lib:163（bundle sources）、lib:189（spec bundleBytes）等全部复用；在入口归一化即一次覆盖所有 case verdict 路径。
2. **语义对齐**：与 CLI `sha()`（CLI:17-23）注释声明的意图一致——"a chain frozen on a Windows checkout (CRLF) validates identically on a POSIX checkout (LF)"。
3. **幂等性**：CRLF→LF 归一化幂等，不引入二次漂移；对已按 LF 归一化冻结的声明 sha（bundle 19/19 实测）无破坏。
4. **不改声明、不碰 outcome 文件**：验收标准允许"声明 sha 不变"，D-A 满足，D-C 不满足。

### 1.2 方案否决理由

- D-B 只改 CLI `artifact()` 返回路径，但 spec 级 `bundleBytes`（lib:189）同样走非归一化 `sha256()`；若 bundle JSON 文件本身含 CRLF，D-B 单独无法闭环 SPEC_INVALID（实施时需实测 gen2 8 个 JSON 文件的换行符分布）。
- D-C 把声明 sha 改为 raw 字节哈希，等价于把验收钉死在 checkout 行为上；v2 plan §3 双环境矩阵要求双端独立 evidence、任一 FAIL = 整体 FAIL，D-C 在 WSL（LF checkout）必然 FAIL，不可接受。

### 1.3 实施前检查项（供实施 session 执行，本 skeleton 不执行）

- [x] `codegraph callers sha256` 记录 impact_analysis（AGENTS.md §9.1；≥2 文件引用即共享函数）——codegraph CLI 本环境不可用，rg 替代（§9.1 允许）：lib `sha256` 调用点仅 lib:163/:189；模块 importers（CLI、单元测试）均不直接调用，各用自有 helper
- [x] 实测 gen2 8 个 JSON 文件 + v1 相关文件的换行符分布（CRLF / LF）——33 个 JSON 实测：gen2 8 文件 + gen2 收据全 CRLF，v1 全 LF（§6.2）
- [x] 对 v1/gen2 每个声明 sha 复算 raw 与归一化两版哈希，确认声明 sha 的归一化语义（§0.3 链重冻结引文为预期依据）——19 个 bundle artifact 复算：raw 6/19、LF 归一化 19/19（§6.2）

## 2. 验收标准

- Windows Git Bash: `bun run scripts/validate-outcome-governance.ts plans/task-lens-outcome-v1 --repository-root "$(pwd)"` → ok:true / lifecycle:ACTIVE / errors:[] / EXIT=0
- WSL Ubuntu-24.04: 同上（native LF checkout）
- 双端 declared sha vs on-disk LF sha 仍 19/19 MATCH（本 skeleton 已实测 19/19 归一化一致，不破坏现有声明）
- `bun run typecheck` EXIT=0（v2 plan §0.4：禁止沿用 predecessor typecheck_exit=1 容忍）
- 不修改 `plans/task-lens-outcome-v1/**`（v2 gen2 8 文件 + ledger + runs 保持不变，声明 sha 不变）
- validator 在新的 raw 字节与声明不匹配时仍正确报错（仅对 CRLF 行尾做归一化，不做其他字节宽容，保留 detecting-different-bytes 能力）

### 2.1 验收标准 → 证据映射

| # | 验收标准 | 验证命令 / 手段 | 期望结果 |
|---|---|---|---|
| A1 | Windows Git Bash validator 通过 | `bun run scripts/validate-outcome-governance.ts plans/task-lens-outcome-v1 --repository-root "$(pwd)"` | `{"ok":true,...,"lifecycle":"ACTIVE","errors":[]}` + EXIT=0 |
| A2 | WSL validator 通过 | 同上（WSL native 执行） | 同上 |
| A3 | 声明 sha 与 LF sha 19/19 MATCH | 复跑 §0.4 复验脚本 | normMismatch = 0（rawMismatch 允许 ≠0） |
| A4 | typecheck EXIT=0 | `bun run typecheck` | EXIT=0 |
| A5 | v2 gen2 文件未变 | `git diff -- plans/task-lens-outcome-v1/` | 无 diff |
| A6 | 检测能力保留 | 对 1 个源文件改非行尾字节后跑 validator | 仍报 `*_HASH_MISMATCH` |

## 3. 工作量与风险

- 工作量（main-session 审计估算）：半日～1 日（单文件级改动 + 双端实跑验证 + 组件回归）。

### 3.1 风险表

| 风险 | 影响 | 缓解 |
|---|---|---|
| lib:102 归一化后 v1/gen2 其他声明 sha 语义翻转 | 历史文件校验失败 | 实施前逐文件复算声明 sha（§1.3），与 §0.3.1 已归一化的 event-004.run_ref（`5a2a1075…`）对账 |
| D-B 单独修复导致 SPEC_INVALID 残留 | 验收不通过 | 推荐 D-A 覆盖 lib 层；D-B 仅作补充选项，不单独实施 |
| 归一化过度（非行尾字节也被宽容） | 检测能力下降 | 仅 `\r\n`→`\n` 转换；验收标准 A6 覆盖 |
| 修改共享函数影响其他 caller | 回归 | CodeGraph impact_analysis（§9.1）+ caller_tests 全量回归（AGENTS.md §8.4） |
| WSL 端未实跑、单端结论外推 | 错误结论 | 验收标准 A2 要求 WSL 实跑；当前仅记 UNVERIFIED 预期 |
| `artifact()` 返回 raw bytes 用于 JSON.parse | 解析路径不受影响 | CRLF 可被 JSON.parse 接受；归一化只影响哈希、不影响文档解析（§0.4 复验中 19 文件均成功 parse） |

### 3.2 前置条件与依赖

- 前置：本 plan 审批通过（DRAFT → READY-FOR-IMPLEMENTATION 由主会话裁决）；§1.3 实施前检查项完成。
- 依赖：无外部依赖；不依赖 v2 plan 任一 phase 进度；不依赖网络。
- 回归基线：`bun test scripts/task-lens` 当前 PASS（v2 plan §4 数据层 13/13 case PASS），实施后须保持 PASS（AGENTS.md §8.4 caller_tests 覆盖）。

## 4. 与 v2 plan 的解耦

本 plan 不修改 `plans/task-lens-m1-completion-v2/**` 任何文件；不修改 `plans/task-lens-outcome-v1/**` 任何文件。修复完成前，v2 plan 在 Windows Git Bash 上 validator 持续 INVALID（BUNDLE TEST_BUNDLE_HASH_MISMATCH + SPEC SPEC_INVALID），但组件测试（bun test scripts/task-lens）与 gen2 数据层（13/13 case PASS）不受影响；v2 plan 的 BLOCKED 状态、§6 phase manifest 与 §7 状态机不被本 plan 改变，直至本 plan 实施且双端验证通过后由主会话决定 v2 是否重新推进。

- **不修改 v2 plan 文件**：cross-link 由 v2 plan §2.4 BLK-V2-002 与本文件头部互指（2026-08-14 Wave 1 建立），不改变 v2 plan 内容语义。
- **不修改 outcome 文件**：v2 gen2 8 文件 + ledger + runs 的声明 sha 保持 LF 归一化语义；实施后 validator 应以现有声明直接通过（若个别声明实为 raw 语义，按 §1.3 对账后走 amendment 流程，不在本 skeleton 承诺范围内）。
- **状态独立**：本 plan DRAFT → 审批 → 实施，不依赖 v2 plan 的 phase 进度；v2 plan 也不依赖本 plan 审批即可维持现状（组件测试与数据层不受影响）。
- **本 plan 是 v2 plan 的前置工具修复**：修复对象是 validator 工具链（`scripts/lib/outcome-governance-v1.ts` + `scripts/validate-outcome-governance.ts`），不是 v2 任一 phase 内容；v2 plan §2.4 BLK-V2-002 已通过 cross-link 指向本 plan 与 handoff。

### 4.1 实施边界与禁令关系

- 本 plan 自身（skeleton）**不产生** `scripts/**` diff（AGENTS.md §4.0 + 本文件头部 Scope）；实施 session 是本 plan 审批通过后的独立授权变更。
- 实施 session 须同时遵守：v2 plan §5.1 Globally forbidden changes 中不属于本 plan 修复对象的部分（`plans/task-lens-outcome-v1/**`、`audits/**`、INDEX 等不在实施范围）、AGENTS.md §9.1 CodeGraph 影响分析、§8.4 caller_tests 覆盖要求。
- 若实施中发现 v2 gen2 声明 sha 并非统一 LF 归一化语义（与 §0.3 引文不符），按 §1.3 检查项对账后升级主会话走 amendment，不擅自修改声明 sha。

## 5. Self-Check Gate

- [x] 根因指向具体行号（lib:102、CLI:22、CLI:39-43）
- [x] 修复方案有对比表
- [x] 验收标准包含双端
- [x] 与 v2 plan 解耦声明
- [x] 双端实跑验证（Windows Git Bash 实跑 EXIT=0 / ok:true / ACTIVE / errors:[]，2026-08-14 Agent D1；WSL 端未实跑——LF 输入下 `replace(/\r\n/g, "\n")` 为无操作，语义等价，标记 UNVERIFIED）

## 6. 实施结果（2026-08-14，Agent D1 / Wave 4）

实施 session 按本 plan 审批 + 用户 §5.1 例外授权执行，采用 D-A 方案，仅修改 `scripts/lib/outcome-governance-v1.ts`。

### 6.1 变更内容

- `sha256()`（lib:102）：单行表达式改为块体——string 直接使用，Uint8Array 经 `Buffer.from(bytes).toString("utf8")` 解码，统一 `text.replace(/\r\n/g, "\n")` 归一化后哈希；与 CLI `sha()`（CLI:17-23）语义一致。
- 实施偏差（方案方向不变，仍为 D-A）：计划示例 `bytes.includes(0x0d)` 对 string 恒 false、`bytes.toString("utf8")` 对 plain Uint8Array 输出逗号连接数字；改用与 CLI `sha()` 相同的解码方式，更稳健。
- 未修改 `plans/task-lens-outcome-v1/**`（A5：`git diff -- plans/task-lens-outcome-v1/` 为空）与 v2 plan 文件。

### 6.2 验证结果（Windows Git Bash，2026-08-14）

| 项 | 修复前 | 修复后 |
|---|---|---|
| validator 实跑 | EXIT=1 INVALID（BUNDLE TEST_BUNDLE_HASH_MISMATCH + SPEC SPEC_INVALID；v2 plan §2.4 / 99-final-verification.md:4 记录） | `{"ok":true,...,"lifecycle":"ACTIVE","errors":[]}` EXIT=0 |
| bundle 19 artifact sha | raw 6/19 匹配（13 个 CRLF 文件不匹配） | raw_match=6 lf_match_only=13 neither=0（lib 归一化后全部通过） |
| 换行符分布 | — | 33 个 JSON：gen2 8 文件 + gen2 收据全 CRLF，v1 全 LF |
| typecheck | — | `bun run typecheck` EXIT=0 |
| 回归测试 | 156 PASS（v2 plan 基线） | `bun test scripts/task-lens` 156 pass / 0 fail |
| lib 单元测试 | — | `bun test scripts/lib/__tests__/outcome-governance-v1.test.ts` 12 pass / 0 fail |
| A6 检测能力保留 | — | 对 input-diff.test.ts 追加非行尾字节 → SOURCE_HASH_MISMATCH + EXIT=1；`git checkout` 还原后复跑 EXIT=0 |

### 6.3 未完成 / 风险

- A2 WSL 实跑未执行（本环境为 Windows Git Bash）：LF 输入下归一化为无操作，预期 EXIT=0，标记 UNVERIFIED。
- 共享函数影响面：lib `sha256` 调用点仅 lib:163/:189；模块 importers（CLI、lib 单元测试）不直接调用（codegraph 不可用，rg 替代）。
- 本 plan 已实施但主会话未验收：最终 Accept 权属主会话；WSL 端实跑与 A6 独立复验建议由主会话复核。
