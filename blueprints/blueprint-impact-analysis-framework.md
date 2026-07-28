# Blueprint: 共享函数改动影响面分析框架

**创建日期**: 2026-07-23
**更新日期**: 2026-07-28
**状态**: 已完成
**相关蓝图**: 无

**版本**: v1.0.0
**日期**: 2026-07-23
**原状态（PHASE-03 前自述）**: 已实施（2026-07-23，component-only，Track A + Track B 全部完成）
**优先级**: P1

---

## 一、问题背景

### 1.1 问题描述

P0-3-01 在 `scripts/test-serve/run-context.ts` 中为共享函数 `setRunState` 添加了 `TRANSITION_TABLE` 守卫。该函数被 6 个文件、12 个调用点使用。但 P0-3-01 的 scope 和验证命令只覆盖了被修改的文件（3 个测试文件），未覆盖所有调用方。结果导致 5 处非法状态转换在生产路径中会 throw，但全部被测试掩盖：

1. `stopRunProcesses` 从 `BOOTSTRAPPED/READY/WORKTREE_READY` 调 `setRunState("STOPPED")` — 全部非法
2. `startRunProcesses` 重启路径 `STOPPED -> READY` — 非法
3. `cleanupRun` 的 `BLOCKED -> CLEANED` 和 `BLOCKED -> BLOCKED` — 非法
4. `execute.ts` gate 含不可达的 `READY` 死分支
5. 所有触及 `stopRunProcesses` 的测试注入 fake，绕过真实 `setRunState`

### 1.2 根因分析

**直接原因**：P0-3-01 的验证命令 `bun test run-context.test.ts process.test.ts sse-daemon.test.ts` 只跑了 3 个测试文件，未包含 `cleanup-integration.test.ts`、`execute.test.ts`、`bootstrap.test.ts`、`cleanup.test.ts` 等调用方测试。

**根本原因**：scope 按"改了哪些文件"定义，不按"影响了哪些调用方"定义。当修改共享函数（被 ≥2 个文件调用的函数）时，所有调用方都受影响，但 scope 和验证命令没有覆盖它们。三道防线全部失效：

| 防线 | 应做什么 | 实际做了什么 | 失效原因 |
|------|---------|------------|---------|
| 实施前 | 查所有调用方，评估影响面 | 只看 scope 内文件 | AGENTS.md §9.1 只管 work-one |
| 实施中 | 跑所有调用方测试 | 只跑 3 个测试文件 | 验证命令只覆盖 scope 内 |
| 审计时 | 验证所有调用方兼容 | 只验证 scope 内文件 | scope 按文件定义 |

### 1.3 实测验证

```
$ codegraph callers setRunState
Callers of "setRunState" (12):
  bootstrapRun         scripts/test-serve/bootstrap.ts
  startRunProcesses    scripts/test-serve/process.ts
  stopRunProcesses     scripts/test-serve/process.ts
  executeRun           scripts/test-serve/execute.ts
  createRunContext     scripts/test-serve/run-context.ts
  cleanupRun           scripts/test-serve/cleanup.ts
  run-context.test.ts  scripts/test-serve/__tests__/
  cleanup-integration.test.ts  scripts/test-serve/__tests__/
  ...
```

CodeGraph CLI 存在于 `/home/zhaoge/.local/bin/codegraph`，索引了 qoderwork（155 files, 2779 nodes），`codegraph callers` 可用。但 AGENTS.md §9.1 只要求 work-one 改动前查 CodeGraph，不要求 qoderwork scripts 改动前查。

**结论**：工具存在且可用，但规则未要求使用，导致影响面分析被跳过。

---

## 二、解决方案

### 2.1 方案概述

| 需求 | 解决方案 |
|------|---------|
| 规则覆盖 qoderwork scripts | 扩展 AGENTS.md §9.1 适用范围 |
| scope 包含影响面 | scope-lock 模板新增 `impact_analysis` 字段 |
| 验证命令覆盖调用方 | plan Fixed verification 必须包含 `impact_analysis.caller_tests` |
| fake 测试不掩盖真实路径 | 新增测试策略：共享函数至少 1 个非-fake 测试 |
| 影响面分析自动化 | 新建 `scripts/impact-scan.ts` 工具 |

### 2.2 核心设计

#### 2.2.1 AGENTS.md §9.1 规则扩展

将 §9.1 标题和正文从：

```
### 9.1 强制规则

**分析或修改 work-one 代码前，必须先用 CodeGraph CLI 查询影响范围。**
```

改为：

```
### 9.1 强制规则

**分析或修改 work-one 代码或 qoderwork `scripts/` 下的共享函数前，必须先用 CodeGraph CLI 查询影响范围。**

"共享函数"定义：被 2 个以上文件调用的函数。判断方法：`codegraph callers <函数名>` 返回的 `file` 级别调用方 ≥ 2 个文件时，该函数为共享函数。

查询结果必须记录到 plan 的 scope-lock `impact_analysis` 字段中。如果 CodeGraph 未索引目标文件，用 `rg -n "函数名" scripts/` 作为替代。
```

#### 2.2.2 scope-lock 模板新增 impact_analysis 字段

在 `templates/scope-lock-template.json` 的 `repository_scope` 之后、`approval` 之前新增：

```json
"impact_analysis": {
  "modified_functions": [],
  "shared_functions": [],
  "caller_scan_command": "",
  "caller_files": [],
  "caller_tests": [],
  "scan_output_sha256": ""
}
```

字段语义（精确定义，无歧义）：

| 字段 | 类型 | 填写规则 |
|------|------|---------|
| `modified_functions` | `string[]` | 列出本次 plan 实施将修改其函数体的函数名。不修改函数体的文件级 import 不列入。无则空数组。 |
| `shared_functions` | `string[]` | `modified_functions` 中满足"共享函数"定义的子集。判断标准：`codegraph callers <函数名>` 返回的 `file` 级别调用方 ≥ 2 个文件。无则空数组。 |
| `caller_scan_command` | `string` | 生成 `caller_files` 的命令。格式：`codegraph callers <函数名>` 或 `rg -n "函数名" scripts/`。无共享函数时为空字符串。 |
| `caller_files` | `string[]` | `shared_functions` 中每个函数的所有调用方文件路径（相对路径）。无共享函数时为空数组。 |
| `caller_tests` | `string[]` | `caller_files` 中每个文件对应的测试文件路径。规则：文件 `foo.ts` 对应测试 `__tests__/foo.test.ts`；如果该测试文件不存在，不列入。无共享函数时为空数组。 |
| `scan_output_sha256` | `string` | `caller_scan_command` 输出内容的 SHA-256。用于证明扫描真实执行。无共享函数时为空字符串。 |

#### 2.2.3 plan-audit-archiver SKILL.md 新增 Step 1.5

在 Step 1（Freeze the audit capsule）和 Step 2（Build the oracle）之间新增：

```markdown
### Step 1.5: Impact analysis for shared functions [ANALYSIS]

If the plan modifies any function body (not just imports or type definitions),
identify shared functions and record their callers:

1. List all functions whose body will be modified in `impact_analysis.modified_functions`.
2. For each, run `codegraph callers <函数名>` (or `rg -n "函数名" scripts/` if not indexed).
3. If the returned `file`-level callers span ≥ 2 files, add the function to
   `impact_analysis.shared_functions`.
4. Record all caller files in `impact_analysis.caller_files`.
5. For each caller file, determine its test file path:
   - `scripts/foo.ts` → `scripts/__tests__/foo.test.ts` (or `scripts/test-serve/__tests__/foo.test.ts`)
   - If the test file does not exist, omit it.
6. Record test files in `impact_analysis.caller_tests`.
7. Hash the scan output and record in `impact_analysis.scan_output_sha256`.
8. The plan's Fixed verification command MUST include every file in
   `impact_analysis.caller_tests`. If it does not, the scope-lock is INVALID.
```

#### 2.2.4 验证命令规则

在 AGENTS.md §8.2（测试证据要求）末尾新增一段：

```
### 8.4 共享函数验证覆盖规则

当 scope-lock 的 `impact_analysis.shared_functions` 非空时，plan 的 Fixed verification 命令必须包含 `impact_analysis.caller_tests` 中列出的每一个测试文件。

验证方法：将 Fixed verification 命令中的测试文件列表与 `impact_analysis.caller_tests` 做集合比较。如果 `caller_tests` 中有文件不在验证命令中，验证不通过。

例外：如果 `caller_tests` 中的某个测试文件需要特殊环境（如 `P0_1B_PORT`），在 plan 中标注并说明原因，可豁免该文件。
```

#### 2.2.5 测试策略：fake 注入标注与真实路径覆盖

在 AGENTS.md §8.3（禁止事项）之后新增 §8.5：

```
### 8.5 共享函数测试覆盖策略

**fake 注入标注**：

当测试通过依赖注入（dependency injection）替换真实函数实现时（如 `stopRunProcesses: async () => { return mockManifest; }`），必须在该测试上方添加注释：

```typescript
// FAKE-INJECTION: stopRunProcesses replaced, real setRunState not exercised
```

**真实路径覆盖**：

对于 scope-lock `impact_analysis.shared_functions` 中的每个共享函数，至少 1 个测试必须调用该函数的真实实现（不通过 fake/mock 替换）。如果现有测试全部使用 fake 注入，实施者必须新增至少 1 个非-fake 测试。

**审计检查**：

审计者在 Step 5（Complete the full in-scope sweep）中，对每个共享函数执行以下检查：
1. `rg -n "FAKE-INJECTION" <caller_test_file>` 列出所有 fake 注入点。
2. 确认至少 1 个测试不包含 `FAKE-INJECTION` 注释且调用了该共享函数的真实路径。
3. 如果全部测试都是 fake 注入，标记为 BLOCKING finding。
```

#### 2.2.6 scripts/impact-scan.ts 工具

新建 `scripts/impact-scan.ts`，自动化 Step 1.5 的流程：

```typescript
#!/usr/bin/env bun
// impact-scan.ts - 共享函数影响面扫描工具
//
// 用法:
//   bun run scripts/impact-scan.ts --functions setRunState,writeRunManifest
//   bun run scripts/impact-scan.ts --functions setRunState --output impact-report.json
//
// 输出 JSON:
// {
//   "scanned_functions": ["setRunState"],
//   "shared_functions": ["setRunState"],
//   "caller_files": ["scripts/test-serve/bootstrap.ts", ...],
//   "caller_tests": ["scripts/test-serve/__tests__/bootstrap.test.ts", ...],
//   "scan_output_sha256": "..."
// }

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";

interface ImpactReport {
  scanned_functions: string[];
  shared_functions: string[];
  caller_files: string[];
  caller_tests: string[];
  scan_output_sha256: string;
}

function runCodegraphCallers(functionName: string): string {
  // Use Bun.spawnSync to run codegraph callers <functionName>
  const result = Bun.spawnSync({
    cmd: ["codegraph", "callers", functionName],
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode !== 0) {
    // Fallback to rg if codegraph fails
    const rgResult = Bun.spawnSync({
      cmd: ["rg", "-n", functionName, "scripts/"],
      stdout: "pipe",
      stderr: "pipe",
    });
    return rgResult.stdout.toString();
  }
  return result.stdout.toString();
}

function parseCallerFiles(scanOutput: string): string[] {
  // Parse codegraph callers output to extract unique file paths
  const files = new Set<string>();
  for (const line of scanOutput.split("\n")) {
    // codegraph output format: "  scripts/test-serve/bootstrap.ts:116"
    const match = line.match(/^\s*(scripts\/[^\s]+\.ts)/);
    if (match) {
      files.add(match[1]);
    }
  }
  return [...files].sort();
}

function findTestFile(sourceFile: string): string | null {
  // scripts/test-serve/foo.ts -> scripts/test-serve/__tests__/foo.test.ts
  // scripts/foo.ts -> scripts/__tests__/foo.test.ts
  const dir = dirname(sourceFile);
  const base = sourceFile.split("/").pop()!.replace(".ts", ".test.ts");
  const testPath = join(dir, "__tests__", base);
  return existsSync(testPath) ? testPath : null;
}

function main(): void {
  const funcsArg = process.argv[process.argv.indexOf("--functions") + 1];
  if (!funcsArg) {
    console.error("Usage: impact-scan.ts --functions <comma-separated>");
    process.exit(1);
  }
  const functions = funcsArg.split(",").map((f) => f.trim());

  const allCallerFiles = new Set<string>();
  const allCallerTests = new Set<string>();
  const sharedFunctions: string[] = [];
  let combinedOutput = "";

  for (const func of functions) {
    const output = runCodegraphCallers(func);
    combinedOutput += output;
    const callers = parseCallerFiles(output);
    // Filter out the definition file itself
    const externalCallers = callers.filter((f) => !f.endsWith(`/${func}.ts`));
    if (externalCallers.length >= 2) {
      sharedFunctions.push(func);
      externalCallers.forEach((f) => allCallerFiles.add(f));
    }
  }

  for (const file of allCallerFiles) {
    const testFile = findTestFile(file);
    if (testFile) allCallerTests.add(testFile);
  }

  const report: ImpactReport = {
    scanned_functions: functions,
    shared_functions: sharedFunctions,
    caller_files: [...allCallerFiles].sort(),
    caller_tests: [...allCallerTests].sort(),
    scan_output_sha256: createHash("sha256").update(combinedOutput).digest("hex"),
  };

  const outputArgIndex = process.argv.indexOf("--output");
  if (outputArgIndex > 0 && process.argv[outputArgIndex + 1]) {
    const { writeFileSync } = require("node:fs");
    writeFileSync(process.argv[outputArgIndex + 1], JSON.stringify(report, null, 2) + "\n");
  }
  console.log(JSON.stringify(report, null, 2));
}

if (import.meta.main) main();
```

### 2.3 子系统合规审计

本 blueprint 改动的是 qoderwork 自身的规则和工具，不涉及 work-one 框架的 12 个子系统。但需检查对 qoderwork 内部流程的影响：

| # | 检查项 | 状态 | 说明 |
|---|--------|:----:|------|
| 1 | AGENTS.md 一致性 | ✅ | §9.1 扩展不与其他章节冲突 |
| 2 | scope-lock 向后兼容 | ✅ | `impact_analysis` 是新增可选字段，旧 scope-lock 无此字段不报错 |
| 3 | validate-audit.ts 兼容 | ✅ | 不修改 validator，新字段不参与验证（仅 plan-audit-archiver 流程使用） |
| 4 | pre-check-evidence.ts 兼容 | ✅ | 不修改 pre-check，新字段不参与预检 |
| 5 | plan-audit-archiver 向后兼容 | ✅ | Step 1.5 是新增步骤，不影响 Step 1-9 的现有逻辑 |
| 6 | impact-scan.ts 独立性 | ✅ | 独立脚本，不依赖 work-one，不修改现有代码 |
| 7 | 测试策略不破坏现有测试 | ✅ | `FAKE-INJECTION` 注释是新增标注，不改测试行为 |
| 8 | CodeGraph 索引覆盖 | ⚠️ | CodeGraph 索引主 qoderwork 目录，worktree 中可能有偏差。`rg` 作为 fallback |

---

## 三、实施清单

### 3.1 文件变更列表

| 序号 | 文件 | 变更类型 | 说明 |
|------|------|---------|------|
| 1 | `AGENTS.md` | 修改 | §9.1 扩展适用范围；新增 §8.4 共享函数验证覆盖规则；新增 §8.5 共享函数测试覆盖策略 |
| 2 | `.agents/skills/plan-audit-archiver/templates/scope-lock-template.json` | 修改 | 新增 `impact_analysis` 字段 |
| 3 | `.agents/skills/plan-audit-archiver/SKILL.md` | 修改 | Step 1 和 Step 2 之间新增 Step 1.5 |
| 4 | `scripts/impact-scan.ts` | 新建 | 共享函数影响面扫描工具 |
| 5 | `scripts/test-serve/__tests__/impact-scan.test.ts` | 新建 | impact-scan.ts 组件测试 |

### 3.2 实施步骤

**实施分为两个 track，可并行**：

#### Track A: 治理变更（需用户直接审批，不走 scope-lock）

**Step A1**: 修改 AGENTS.md §9.1

将：
```
**分析或修改 work-one 代码前，必须先用 CodeGraph CLI 查询影响范围。**
```
改为：
```
**分析或修改 work-one 代码或 qoderwork `scripts/` 下的共享函数前，必须先用 CodeGraph CLI 查询影响范围。**

"共享函数"定义：被 2 个以上文件调用的函数。判断方法：`codegraph callers <函数名>` 返回的 `file` 级别调用方 ≥ 2 个文件时，该函数为共享函数。

查询结果必须记录到 plan 的 scope-lock `impact_analysis` 字段中。如果 CodeGraph 未索引目标文件，用 `rg -n "函数名" scripts/` 作为替代。
```

**Step A2**: 在 AGENTS.md §8.3 之后新增 §8.4 和 §8.5

精确文本见 §2.2.4 和 §2.2.5。

**Step A3**: 写治理变更日志 `logs/YYYY-MM-DD-governance-impact-analysis.md`

#### Track B: 框架代码变更（component-only plan）

**Step B1**: 建 plan `plans/框架改进/impact-scan-tool.md`，声明 `provenance_level: component-only`

**Step B2**: 建 scope-lock，allowed_paths 包含：
- `.agents/skills/plan-audit-archiver/templates/scope-lock-template.json`
- `.agents/skills/plan-audit-archiver/SKILL.md`
- `scripts/impact-scan.ts`
- `scripts/test-serve/__tests__/impact-scan.test.ts`

**Step B3**: 人审 scope-lock

**Step B4**: capture-state.ts pre-change receipt

**Step B5**: 实施
1. 修改 scope-lock-template.json：在 `repository_scope` 后、`approval` 前插入 `impact_analysis` 字段（见 §2.2.2）
2. 修改 SKILL.md：在 Step 1 和 Step 2 之间插入 Step 1.5（见 §2.2.3）
3. 新建 `scripts/impact-scan.ts`（见 §2.2.6 代码）
4. 新建 `scripts/test-serve/__tests__/impact-scan.test.ts`：
   - 测试 1: `parseCallerFiles` 正确解析 codegraph 输出
   - 测试 2: `findTestFile` 正确映射源文件到测试文件
   - 测试 3: `shared_functions` 只包含调用方 ≥ 2 文件的函数

**Step B6**: 验证
```bash
cd /home/zhaoge/workspace/qoderwork
bun test scripts/test-serve/__tests__/impact-scan.test.ts
bun run typecheck
git diff --check
```

**Step B7**: 写日志 + LATEST.md

---

## 四、验证计划

### 4.1 单元测试

- [ ] `impact-scan.ts` 的 `parseCallerFiles` 正确从 codegraph 输出提取文件路径
- [ ] `impact-scan.ts` 的 `findTestFile` 正确映射 `scripts/test-serve/foo.ts` -> `scripts/test-serve/__tests__/foo.test.ts`
- [ ] `impact-scan.ts` 的 `findTestFile` 对不存在的测试文件返回 null
- [ ] `impact-scan.ts` 的 `shared_functions` 只包含 external callers ≥ 2 的函数
- [ ] `impact-scan.ts` 的 `scan_output_sha256` 非空且为 64 位 hex

### 4.2 集成测试

- [ ] `bun run scripts/impact-scan.ts --functions setRunState` 输出包含 `shared_functions: ["setRunState"]`
- [ ] 输出的 `caller_files` 包含 `scripts/test-serve/bootstrap.ts`、`scripts/test-serve/execute.ts`、`scripts/test-serve/process.ts`、`scripts/test-serve/cleanup.ts`
- [ ] 输出的 `caller_tests` 包含对应的 `__tests__/*.test.ts` 文件

### 4.3 端到端验证

- [ ] 新建一个测试 plan，修改 `setRunState`，走完整 scope-lock 流程，验证 `impact_analysis` 字段被正确填写
- [ ] 验证 plan 的 Fixed verification 命令包含 `caller_tests` 中的所有文件
- [ ] 验证 `FAKE-INJECTION` 标注规则在现有测试中被正确应用

### 4.4 回归验证

- [ ] 现有 scope-lock（如 `audits/p0-3/scope-lock-PHASE-01.json`）不含 `impact_analysis` 字段时，validate-audit.ts 仍 exit 0
- [ ] 现有 plan-audit-archiver 流程不因 Step 1.5 新增而中断

---

## 五、风险与缓解

### 5.1 风险

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| CodeGraph 在 worktree 中索引偏差 | `caller_files` 不完整 | `rg` 作为 fallback；`codegraph sync` 可手动同步 |
| `impact_analysis` 字段被 validator 拒绝 | scope-lock 无法冻结 | validator 不检查此字段（仅 plan-audit-archiver 流程使用） |
| 现有测试无 `FAKE-INJECTION` 标注 | 审计时需补标注 | 标注是渐进式的，首次审计时由审计者补注 |
| `impact-scan.ts` 依赖 codegraph 二进制 | 新环境无 codegraph | 脚本内置 `rg` fallback |

### 5.2 回滚方案

1. **AGENTS.md 回滚**：`git revert` 治理变更提交，恢复 §9.1 原文
2. **scope-lock 模板回滚**：`git revert` 模板变更提交，`impact_analysis` 字段移除
3. **SKILL.md 回滚**：`git revert` Step 1.5 移除
4. **impact-scan.ts 回滚**：`rm scripts/impact-scan.ts` + `rm scripts/test-serve/__tests__/impact-scan.test.ts`

所有变更均为增量（新增字段、新增步骤、新增文件），回滚不破坏现有功能。

---

## 六、成功标准

- [ ] AGENTS.md §9.1 覆盖 qoderwork `scripts/` 共享函数
- [ ] scope-lock 模板包含 `impact_analysis` 字段
- [ ] plan-audit-archiver SKILL.md 包含 Step 1.5
- [ ] `scripts/impact-scan.ts` 存在且 `bun run scripts/impact-scan.ts --functions setRunState` 输出正确的 `shared_functions` 和 `caller_files`
- [ ] `bun test scripts/test-serve/__tests__/impact-scan.test.ts` exit 0
- [ ] `bun run typecheck` 无新增错误
- [ ] 现有 scope-lock 和 validator 不受影响（向后兼容）
- [ ] AGENTS.md §8.4 和 §8.5 存在且措辞无歧义

---

## 七、附录

### 7.1 相关文件

- `AGENTS.md` §9.1（CodeGraph 使用规则）
- `AGENTS.md` §8.2-8.3（测试证据要求与禁止事项）
- `.agents/skills/plan-audit-archiver/SKILL.md`（审计流程）
- `.agents/skills/plan-audit-archiver/templates/scope-lock-template.json`（scope-lock 模板）
- `scripts/test-serve/run-context.ts`（`setRunState` 定义）
- `plans/隔离 serve 测试基建待办/p0-3/07-hotfix-transition-table.md`（事故源 hotfix）

### 7.2 事故时间线

1. P0-3-01 实施 `TRANSITION_TABLE` 守卫（scope 仅覆盖 3 个文件）
2. 验证命令跑 3 个测试文件，28 pass / 0 fail
3. 子 Agent 主动扫描 `setRunState` 调用方，发现 3 个 out-of-scope 问题
4. code-explorer 全面排查，发现 `stopRunProcesses` 系统性冲突（5 处非法转换）
5. Hotfix 修复转换表（P0-3-HOTFIX-TT，component-only）
6. 本 blueprint 提出系统性解决方案（规则 + 工具 + 测试策略）
