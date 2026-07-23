# task-lens 跨 session 续接纪要

**日期**: 2026-07-23
**用途**: 供新 session 续接 task-lens 任务。主蓝图 M1 已可实施；M2/M3 边界见蓝图 §〇。
**主文档**: `blueprints/blueprint-task-lens-m1.md` (v0.1.4)
**演进日志**: `logs/2026-07-23-task-lens-blueprint.md`

---

## 一、续接读序

1. 蓝图 §〇 路线图（M1→M2→M3 闸门全局）
2. 蓝图 §八 设计图纸（成品 → 过程 → 结构）
3. 蓝图 §1-§7 正文（M1 完整设计）
4. 演进日志（v0.1.0 → v0.1.4）
5. 本纪要（决策 / 调查 / 缺口）

## 二、Q1-Q8 决策（塑造设计的关键分叉）

| Q | 问题 | 决议 | 落点 |
|---|------|------|------|
| Q1 | 建造顺序 | 先丑后美 | 蓝图 §〇（M1→M2→M3 各挂闸门） |
| Q2 | 归属 | `qoderwork/scripts/task-lens/`，零内部耦合，可抽独立项目 | 蓝图 §3.1 |
| Q3 | test-serve 集成 | M1 手动 CLI；自动挂接 M2 后评估 | 蓝图 §2.4 |
| Q4 | spine 入口识别 | 小型注册表 + fallback 最远调用方 | 蓝图 §2.4.4 |
| Q5 | 种子粒度 | 默认 HEAD 工作区 diff，支持 commit range；跨 worktree 不在 M1 | 蓝图 §2.4.2 |
| Q6 | 录制范围/性能预算 | 推迟到 M2 门前 | 蓝图 §7.3 |
| Q7 | 副作用节点重跑策略 | 推迟到 M2 门前 | 蓝图 §7.3 |
| Q8 | 成效度量 | 轻量内建：卡片反馈区 + `metrics.jsonl`；验收 = 10 任务回看 | 蓝图 §六 |

## 三、红线与不变量

五条红线（跨里程碑恒成立）：①边只来自确定性工具 ②一屏预算 ≤20 节点 ③声明值/观测值分列 ④交互必出 receipt ⑤产物一次性。

通用性不变量 G1-G5（M1 即遵守）：只读语言级产物 / 目标项目零侵入 / StructureProvider 接口隔离 / 项目差异收敛到 `task-lens.config.yaml` / coverage 契约绑定 lcov 格式。详见蓝图 §2.4.0。

## 四、工具重叠调查（仅记于此，不入蓝图）

用户曾调研市面工具是否已满足诉求。结论：执行可视化那一半有工具做得更好，但 task-lens 的缓冲/注意力分配角色无工具覆盖。**用户已示"按既定方向"（即 Option B），本节仅为续接留档，不影响蓝图。**

核实结果：
- **Ariana**：VERIFIED（npm `v0.5.2` / `github.com/dedale-dev/ariana` / AGPL-3.0 / 周下载 16 / 一年未更新）。零插桩 + hover 任意表达式看最后执行值 + 代码染色 + Bun 支持 + VSCode/Cursor。**红旗**：源码发送到欧盟服务器处理 48h（违反 G1/G2 本地零侵入）；AGPL；周下载极低。
- **trakk-js**：VERIFIED（npm / `github.com/trakkjs/trakk-js`）。前端浮动面板，**前端 only**，与 Bun/Node 后端无关。
- **Spy-js**：真实（JetBrains 内置），Bun 兼容差（未实测）。

重叠矩阵（行=工具，列=task-lens 能力；A=diff锚定主干叙事 B=静态+观测融合含未执行路径 C=执行染色 D=录制入参出参 E=改参重跑+receipt F=图作地图 G=确定性本地缓冲+receipt H=Bun/Node后端）：

| 工具 | A | B | C | D | E | F | G | H |
|------|---|---|---|---|---|---|---|---|
| Ariana | ✗ | ✗ | ✓✓ | ✓✓ | ✗ | ✗ | ✗ | ✓ |
| Spy-js | ✗ | ? | ✓ | ✓ | ? | ✓ | ✗ | ? |
| trakk-js | ✗ | ✗ | ✓ | ✓ | ✗ | ✓ | ✗ | ✗ |
| task-lens | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

**重叠**：集中在 C/D（执行染色与录制值），Ariana 更强。
**不重叠（task-lens 独有）**：A=diff 锚定主干叙事、B=静态+观测融合含未执行路径、E=改参重跑+receipt、G=确定性本地缓冲+receipt——这四项恰是用户最初诉求"不知道该主要看什么"的落点。

## 五、战略分叉（待主会话决策，未决）

- **Option A**：task-lens 收窄为 diff 锚定缓冲层，执行可视化交 Ariana（若代码可发云）→ M2 大部分砍。
- **Option B**：全自建（当前蓝图方向），换来本地化（不发云）/ receipt 接 audits / 图作地图 / 缓冲纯净。
- **Option C**：只留 M1，执行可视化全交 Ariana，画布不做。

**当前倾向**：用户示"按既定方向"→ Option B。但 Ariana 发云对私有 work-one 可能是硬阻断，需在 M2 门前再确认一次（若确认阻断，B 反而更稳）。

## 六、缺口清单（只在对话里，新 session 注意）

1. M2/M3 完整设计未独立成 spec（蓝图 §〇 只给边界与闸门，不给实现细节）。
2. Q1-Q8 推理过程（决议见本纪要 §二，理由在原始对话）。
3. 动态调用精度解释 + edge-confidence 推理链（概念在蓝图，论证在对话）。
4. 工具调查详情（本纪要 §四 已补，蓝图未含）。
5. 设计演化脉络（缓冲带→交互画布→契约/inspector→蓝图；日志一句带过）。

## 七、未决 UNVERIFIED 项

- bun lcov 函数级输出（M1 Phase 1 spike，备 text 降级）
- codegraph SQLite schema 直查 / 对任意项目建索引能力（备 CLI 逐个查询 / ts-morph provider）
- `node:diagnostics_channel` 在 Bun 兼容性（M2 备选观测源）
- Ariana 在 work-one 实跑通（仅当走 Option A 才需要）

## 八、下一步建议

1. 主会话确认战略走向（A/B/C），默认 B。
2. 启动 M1 Phase 1 spike：实测 bun lcov 输出 + codegraph SQLite schema，定型首选/fallback。
3. M1 实施按蓝图 §3.2 四 Phase（约 3 天）。
4. M1 通过其闸门后，再补 M2 详细 spec（触发蓝图 v0.2）。

---

**文件状态**：蓝图与日志当前为 git 未提交的 working-tree 变更（含 v0.1.4 §〇 + 本纪要新增）。新 session 可直接读磁盘文件；如需版本固化，提示用户提交。
