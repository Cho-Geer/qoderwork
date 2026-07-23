# P0-3-01 退出条件预存噪音

**日期**: 2026-07-22

**来源**: P0-3-01 `01-phase-state-contract.md` 实施前冻结审计（scope-lock-PHASE-01.json）退出条件预检

**关联文件**:
- `audits/p0-3/scope-lock-PHASE-01.json`
- `scripts/_b1_live.ts`
- `scripts/test-serve/run-context.ts`
- `plans/隔离 serve 测试基建待办/p0-3/01-phase-state-contract.md`

## 问题 1：typecheck 预存 TS2307 错误

### 现象

运行 `bun run typecheck`（qoderwork 根目录）时，`scripts/_b1_live.ts` 报 `TS2307`（找不到模块或其对应类型声明）。

### 根因

- `_b1_live.ts` 不在 P0-3-01 scope-lock 的 `allowed_paths` 内，也不是本次 P0-3-01 实施范围要改的文件。
- 该文件是历史遗留文件，引用了一个已不存在或路径变更的模块。

### 为什么成为噪音

P0-3-01 的 exit criterion 原本写为：

```
bun run typecheck exits 0
```

由于这个与 P0-3-01 无关的预存错误，即使本次 scope 内所有文件类型正确，整条命令也会 exit 非 0，导致 exit criterion 形式上无法满足。

### 可选处理路径

| 方案 | 操作 | 影响 |
|------|------|------|
| A | 在本次审计前单独修复 `_b1_live.ts` | 超出 P0-3-01 scope，需要额外批准 |
| B | 将 exit criterion 改为只对 scope 内文件做类型检查 | 降低 criterion 通用性，但精准对应本次 scope |
| C | 在审计报告中将 `_b1_live.ts` 记为 `NON_BLOCKING_DEBT` | 诚实记录，但 exit criterion 不再严格 exit 0 |

**建议**: 优先方案 B，后续若整仓库 typecheck 需要，再单独处理 `_b1_live.ts`。

---

## 问题 2：rg H2_AUTHORIZED 假阳性命中

### 现象

执行 plan 中的静态扫描命令：

```bash
rg -n 'process\.env\.H2_AUTHORIZED\s*=' scripts/test-serve/ .agents/skills/isolated-serve-test/ .qoder/skills/isolated-serve-test/ .trae/skills/isolated-serve-test/ .workbuddy/skills/isolated-serve-test/
```

会在 `scripts/test-serve/run-context.ts:168` 命中：

```ts
h2Authorized: process.env.H2_AUTHORIZED === "true",
```

### 根因

- 该行代码是**比较**（`===`），不是**赋值**（`=`），因此并未违反 "H2_AUTHORIZED 永远不被基础设施代码写入" 的不变量。
- 但正则 `\s*=` 会匹配 `===` 中的**第一个等号**，导致假阳性命中。

### 为什么成为噪音

该扫描命令原本是用于证明 "零赋值"，现在会错误地报告一个命中，可能让 `P03-S-07` 看起来失败。

### 可选处理路径

| 方案 | 操作 | 影响 |
|------|------|------|
| A | 修正 rg 正则为 `process\.env\.H2_AUTHORIZED\s*=\s*[^=]` | 排除 `===`，只匹配真正赋值 |
| B | 保留原命令，但在审计报告中记录为预存假阳性 | 可能降低静态检查可信度 |
| C | 改 `run-context.ts:168` 写法避免命中（如先取值再比较） | 为工具改代码，不推荐 |

**建议**: 优先方案 A，只改扫描命令，不改业务代码。

---

## 当前结论

- 这两个问题都是**预存噪音**，不阻塞 P0-3-01 的实质实施（状态机守卫、重复 run ID 拒绝、manifest 字段、PID 校验、sse-daemon env、H2 不变量）。
- 它们只影响退出条件的字面执行结果，需要在 scope-lock exit criteria 或审计报告中显式处理。
- 推荐将 exit criterion 1 改为对 scope 内文件类型检查，将 exit criterion 4 的 rg 命令改为更精确的正则，然后在审计 downgrade declaration 或 assumption 中说明。

## 验收标准

- [ ] 确认 typecheck 命令范围调整或 `_b1_live.ts` 单独修复
- [ ] 确认 H2_AUTHORIZED 扫描命令精确到只匹配赋值
- [ ] 审计报告通过 `validate-audit.ts` exit 0
