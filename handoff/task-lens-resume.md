# task-lens 跨 session 续接纪要

**日期**: 2026-07-23
**用途**: 供新 session 续接 task-lens 任务。M1 设计返工已收口，下一步是创建实施 plan 并完成 Freeze Gate；尚未授权直接写代码。
**主文档**: `blueprints/blueprint-task-lens-m1.md` (v0.1.5)
**演进日志**: `logs/2026-07-23-task-lens-blueprint.md`

---

## 一、续接读序

1. 蓝图 §〇 路线图（M1→M2→M3 闸门全局）
2. 蓝图 §八 设计图纸（成品 → 过程 → 结构）
3. 蓝图 §1-§7 正文（M1 完整设计）
4. 演进日志（v0.1.0 → v0.1.5）
5. 本纪要（决策 / 调查 / 缺口）

## 二、Q1-Q8 决策（塑造设计的关键分叉）

| Q | 问题 | 决议 | 落点 |
|---|------|------|------|
| Q1 | 建造顺序 | 先丑后美 | 蓝图 §〇（M1→M2→M3 各挂闸门） |
| Q2 | 归属 | `qoderwork/scripts/task-lens/`，零内部耦合，可抽独立项目 | 蓝图 §3.1 |
| Q3 | test-serve 集成 | M1 手动 CLI；自动挂接 M2 后评估 | 蓝图 §2.4 |
| Q4 | spine 入口识别 | 小型注册表 + fallback 最远调用方 | 蓝图 §2.4.4 |
| Q5 | change-set | `working-tree`（HEAD→当前工作区，含 untracked）或 `commit`（base→当前 HEAD）；任意历史 head/跨 worktree 不在 M1 | 蓝图 §2.4.2 |
| Q6 | 录制范围/性能预算 | 推迟到 M2 门前 | 蓝图 §7.3 |
| Q7 | 副作用节点重跑策略 | 推迟到 M2 门前 | 蓝图 §7.3 |
| Q8 | 成效度量 | 轻量内建：卡片反馈区 + `metrics.jsonl`；验收 = 10 任务回看 | 蓝图 §六 |

## 三、红线与不变量

五条红线（跨里程碑恒成立）：①边只来自确定性工具 ②一屏预算 ≤20 节点 ③声明值/观测值分列 ④交互必出 receipt ⑤产物一次性。

通用性不变量 G1-G5（M1 即遵守）：只读语言级产物 / 目标项目预索引且零写入 / StructureProvider capability probe / 项目差异收敛到显式 config / input+artifact 版本化并绑定 hash。详见蓝图 §2.4.0。

## 四、工具重叠调查（仅记于此，不入蓝图）

用户曾调研市面工具是否已满足诉求。结论只限定在已调查的 Ariana / trakk-js / Spy-js 三者：执行可视化有成熟能力，但未发现与 M1 的 diff 锚定、静态+观测融合、确定性本地 receipt 完全重合的工具。用户已决定按 Option B 继续，本节仅为续接留档。

核实结果：
- **Ariana**：官方仓库现重定向至 `github.com/ariana-dot-dev/ariana-debugger`；README 仍声明 Bun 支持、AGPL-3.0、代码在欧盟服务器临时处理 48h，并在本地 `.ariana` 目录处理副本。版本、下载量与活跃度是易漂移快照，续接时不得沿用旧数字冒充当前事实。其云端处理和目标目录写入不满足 task-lens G2。
- **trakk-js**：VERIFIED（npm / `github.com/trakkjs/trakk-js`）。前端浮动面板，**前端 only**，与 Bun/Node 后端无关。
- **Spy-js**：真实（JetBrains 内置），Bun 兼容差（未实测）。

重叠矩阵（行=工具，列=task-lens 能力；A=diff锚定主干叙事 B=静态+观测融合含未执行路径 C=执行染色 D=录制入参出参 E=改参重跑+receipt F=图作地图 G=确定性本地缓冲+receipt H=Bun/Node后端）：

| 工具 | A | B | C | D | E | F | G | H |
|------|---|---|---|---|---|---|---|---|
| Ariana | ✗ | ✗ | ✓✓ | ✓✓ | ✗ | ✗ | ✗ | ✓ |
| Spy-js | ✗ | ? | ✓ | ✓ | ? | ✓ | ✗ | ? |
| trakk-js | ✗ | ✗ | ✓ | ✓ | ✗ | ✓ | ✗ | ✗ |
| task-lens M1（本蓝图） | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓* |
| task-lens M2/M3（规划） | 继承 | 继承 | 计划 | 计划 | 计划 | 计划 | 继承 | 待验证 |

`✓*`：M1 已验证 Bun lcov 的 DA 路径可用；task-lens 实现尚未完成。

**重叠**：未来 M2 的 C/D 与 Ariana 重叠；Ariana 当前产品更成熟。
**本轮不重叠范围**：M1 的 A/B/G。E/F 仍是未来计划，不得写成已具备能力。

## 五、战略决议

- **Option A**：task-lens 收窄为 diff 锚定缓冲层，执行可视化交 Ariana（若代码可发云）→ M2 大部分砍。
- **Option B**：全自建（当前蓝图方向），换来本地化（不发云）/ receipt 接 audits / 图作地图 / 缓冲纯净。
- **Option C**：只留 M1，执行可视化全交 Ariana，画布不做。

**已决**：按用户“既定方向”采用 Option B。M1 不再重复询问 A/B/C；M2 spec 启动时只重新核验外部工具与安全事实，不重新打开 M1 方向。

## 六、v0.1.5 审核返工状态

已关闭：

1. Bun 1.3.14 lcov 无 FN/FNDA → M1 固定 `DA ∩ functionRange` 三态路径。
2. 自由 `--range` 歧义 → 固定 working-tree/commit 两种 change-set。
3. M3 无 JSON 输入、`Map` 不可序列化 → M1 固定 `task-lens.task-graph/v1` 数组 schema。
4. 单路径无法覆盖分叉 seeds → 改 `SpineForest` + 拆卡 + uncoveredSeeds。
5. feedback 无 metrics 回写 → 增加 generated/feedback 事件与 task_id。
6. `component-only` 与 integration 闸门冲突 → 实施 plan 固定 `v2.1-required`。
7. 命令/路径/资源安全、原子 artifact、metrics 并发契约已补入蓝图。

仍开放：

1. 尚未创建 M1 实施 plan、scope-lock、Human approval 与 pre-change receipt；因此禁止写代码。
2. M2/M3 未独立成 spec，只是路线图边界。
3. M2 inspector/cpu-prof 旧 `/tmp` 探针非耐久证据，必须固化后重跑。
4. Q1-Q8 的完整推理过程仍只存在于原始对话，本纪要保留决议而不伪造过程。

## 七、未决 UNVERIFIED 项

- CodeGraph 私有 schema 在后续版本是否兼容（M1 用 capability probe + CLI fallback fail-closed）
- 第二个已索引 TS 项目的零写入出卡（M1 integration gate）
- M2 任意模块函数的 CDP 可达性、source map、异步与副作用隔离
- `node:diagnostics_channel` 在 Bun 的兼容性（M2 备选）

## 八、下一步（固定顺序）

1. 创建 `plans/task-lens-m1/00-plan-index.md`，声明 `provenance_level: v2.1-required`。
2. 完成 scope-lock → Human approval → pre-change receipt；任一步缺失都停止。
3. 按蓝图 §3.2 Phase 1-4 实施 M1，并由 receipts/`validate-audit.ts` 验收。
4. 完成 10 任务门槛后，再决定 M1.5；M1 通过后才创建 M2 独立 spec。

---

**文件状态**：蓝图、handoff 与日志当前为 git 未提交 working-tree 变更（v0.1.5）。新 session 必须以磁盘内容为准；版本固化需由用户决定是否提交。
