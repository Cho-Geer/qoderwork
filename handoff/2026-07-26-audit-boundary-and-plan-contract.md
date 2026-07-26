# 审计边界与 Plan 合同：讨论总结与交接

**日期**：2026-07-26
**性质**：方法论交接；不改变任何现有 plan、Phase 状态、审计 verdict 或实现范围。

## 1. 一句话结论

审计的核心不是确认“代码改了”或“测试绿了”，而是用可信的当前证据判断：

```text
实施后的实际边界 = 已批准需求的预期边界
```

实施边界更窄意味着漏做；更宽意味着越权、副作用或风险；只有边界一致且证据可信，实施才可被接受。

## 2. 需求必须先定义边界

每项关键需求都应包含以下三类边界，并给出验证方式：

| 边界 | 必须回答的问题 |
|---|---|
| 成功边界 | 哪些输入、状态和权限下必须成功？可观察结果是什么？ |
| 失败边界 | 哪些情况必须拒绝、报错、停止或回滚？失败后哪些动作绝不能发生？ |
| 不变边界 | 哪些模块、调用方、数据、权限和兼容行为不得受影响？ |
| 验证边界 | 正例、反例、通过/失败信号及证据层级是什么？ |

可审计需求的表达形态应接近：

> 在条件 A 下必须产生结果 B；在条件 C 下必须以错误 D 失败，且不得执行 E；除允许范围 F 外，其他行为保持不变。

## 3. 审计的三层工作

```text
获取证据
  → 验证证据可信
  → 判断实施边界是否符合需求边界
```

1. **获取证据**：运行测试、构造正例和反例、检查 diff、读取日志与运行输出。
2. **验证证据可信**：确认测试针对当前实现、执行环境正确、范围未漂移、证据可复现且不是事后补造。
3. **审核边界一致性**：判断成功、失败和不变边界是否都与批准需求一致。

因此，旧日志、错误环境下的绿色测试、只证明命令会失败的负例、或事后补写的状态材料，都不能自动证明实施正确。

## 4. 脚本与大模型的职责边界

| 主体 | 核心职责 |
|---|---|
| 脚本 | 执行测试、捕获输出、生成 receipt、计算 hash、比对 Git 状态、检查报告结构、作为硬闸门拒绝不合格结论。 |
| 大模型 | 理解需求和现状、定义审计范围、设计可证伪负例、归类异常、判断证据是否足够、发现授权或 provenance 问题时停止。 |
| 人类 | 批准范围和变更边界，决定范围外修复、重建 provenance 或承担风险的例外。 |

简化理解：大模型是审计员，脚本是审计员的仪器与硬闸门。脚本不能替代边界判断；大模型也不能绕过脚本闸门。

## 5. Blueprint 与 Plan 的不同精确度

| 文档 | 主要职责 | 应达到的精确度 |
|---|---|---|
| Blueprint | 说明目标、系统一致性、架构约束、方案取舍、风险和验收方向。 | 边界清楚，但保留基于当前系统调研的设计空间。 |
| Plan | 将已批准边界收敛为唯一实施与验证路径。 | 低自由度、可执行、可验证，关键行为不得依赖实施者猜测。 |

```text
Blueprint 决定“必须达到什么边界，以及为什么”。
Plan 决定“以哪条唯一可验证的路径达到它”。
```

Blueprint 不能模糊到无法导出验收边界；Plan 不能抽象到弱模型仍需自行猜测关键行为、错误码、测试或完成条件。

## 6. Plan 的五项强制收敛方式

每个关键 `REQ` 应按以下顺序写入 Plan：

```text
结构化契约
  → 决策表
  → 状态机 / 不变量
  → 固定 fixtures
  → 可运行 oracle
```

### 6.1 结构化契约

使用 YAML（或等价结构化格式）固定字段、类型和值域；不以散文代替关键输入输出合同。

```yaml
requirement_id: REQ-001
input:
  source: string | null
  mode: CREATE | UPDATE
output:
  result: PASS | FAIL
  error_code: ERR_MISSING_SOURCE | ERR_INVALID_SOURCE | null
side_effects:
  allowed_on_pass: [createArtifact]
  forbidden_on_fail: [createArtifact, publishResult]
```

### 6.2 决策表

每一种条件必须有唯一结果；不得留下“视情况处理”或未定义默认分支。

| 条件 | 结果 | 精确输出 | 后续动作 |
|---|---|---|---|
| `source == null` | FAIL | `ERR_MISSING_SOURCE` | 不调用业务动作 |
| `source` 不合法 | FAIL | `ERR_INVALID_SOURCE` | 不调用业务动作 |
| `source` 合法 | PASS | 创建预期 artifact | 允许进入下一步 |

### 6.3 状态机或不变量

有生命周期的能力必须定义状态机；无明显生命周期的能力至少定义不变量。

```yaml
state_machine:
  allowed:
    - INIT -> VALIDATED
    - VALIDATED -> COMPLETED
    - INIT -> REJECTED
  forbidden:
    - REJECTED -> COMPLETED

invariants:
  - PASS implies exact expected artifact exists
  - FAIL implies no business action occurs after rejection
  - error_code is one declared enum value
```

### 6.4 固定 fixtures

fixtures 是不可随意改写的输入/输出合同。每个核心需求至少有一个正例和一个单变量负例。

```yaml
fixtures:
  positive:
    input: { source: "valid-source", mode: "CREATE" }
    expected: { result: "PASS", artifact: "exact-artifact" }

  negative:
    input: { source: null, mode: "CREATE" }
    expected:
      result: "FAIL"
      error_code: "ERR_MISSING_SOURCE"
      business_calls_after_failure: []
```

负例必须证明系统正确地识别了预期错误；仅让命令非零退出并不构成有效负例。

### 6.5 可运行 oracle

测试直接验证结构化契约、决策表和 fixture。Plan 固定命令、预期结果与证据层级。

```yaml
oracle:
  positive_command: bun test exact.test.ts --test-name-pattern REQ-001-positive
  negative_command: bun test exact.test.ts --test-name-pattern REQ-001-negative
  pass_condition: named tests pass with exact assertions
  failure_condition: negative fixture observes the declared error_code and no later business call
  evidence_level: component
```

## 7. Plan 的最小需求卡片

```yaml
requirement_id: REQ-001
source_boundary: approved Blueprint section and decision
allowed_files: [exact/path.ts, exact/path.test.ts]
forbidden_changes: [unrelated/module.ts, status-only bypass]

contract: structured input/output/value-domain contract
decision_table: one condition to one result mapping
state_machine_or_invariants: allowed transitions and forbidden behavior
fixtures:
  positive: exact input and expected output
  negative: one mutation and exact expected error
oracle:
  commands: exact commands with explicit cwd
  pass_fail_signals: observable output, error code, and assertion count
completion_gate:
  - positive control passes
  - negative control fails for the declared reason
  - allowlist and impact checks pass
  - required evidence is retained
```

## 8. 从需求到审计的闭环

```text
需求边界
  → Blueprint：目标、约束、兼容性和决策
  → Plan：结构化合同与固定验证路径
  → Freeze：批准范围与实施前基线
  → 实施：仅修改允许范围
  → Evidence：正例、反例、影响检查与当前状态
  → Audit：判断实际边界是否等于需求边界
  → Verdict：ACCEPT / REWORK / BLOCKED / INVALID
```

`ACCEPT` 只表示：在已批准范围内，可信证据足以证明实施边界满足需求边界。它不表示系统不存在所有未知问题。

## 9. 后续使用检查清单

在写 Blueprint 时：

- [ ] 目标、成功、失败和不变边界已清楚。
- [ ] 已说明与当前系统约定、兼容性和安全边界的关系。
- [ ] 未过早假设未经调研的具体函数名或错误码。

在写 Plan 时：

- [ ] 每个关键 REQ 有结构化契约、决策表和状态机或不变量。
- [ ] 每个关键 REQ 有固定正例、单变量负例和可运行 oracle。
- [ ] 失败边界包含禁止发生的后续动作。
- [ ] 允许文件、禁止变更、证据层级和 completion gate 明确。
- [ ] 弱模型不需要为关键行为自行补充解释。

在审计时：

- [ ] 证据对应当前实现与批准范围。
- [ ] 正例证明应成功的行为；负例证明应失败的行为。
- [ ] 影响检查证明范围外不变。
- [ ] 证据可信度、冻结时序和授权边界均满足要求。
