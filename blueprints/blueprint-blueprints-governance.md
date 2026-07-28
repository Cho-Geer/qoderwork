# Blueprint: blueprints/ 目录治理与生命周期管理

**版本**: 1.0.1
**创建日期**: 2026-07-28
**更新日期**: 2026-07-28
**状态**: 待审批
**相关蓝图**: 无
**优先级**: P1
**范围**: QoderWork `blueprints/` 目录的元数据规范、状态治理、索引与归档机制；不修改 work-one 产品代码、数据库与运行时配置。

> **治理边界**：本蓝图治理 blueprint（pre-plan）生命周期；与 `blueprint-audit-governance-evidence-and-status-closure-v3`（管 plan/audit-phase 准入、审计边界、证据、发布与状态治理）互补不重叠--本蓝图 M5 消费 closure-v3 产出的 `audits/LATEST.md` 作为状态真相源，不重复定义 plan/audit 治理。

---

## 一、问题背景

### 1.1 问题描述

`blueprints/` 目录现有 30 个文件，无生命周期治理：

1. **无状态看板**：确定任一蓝图的真实进度需跨 `plans/`、`audits/`、`logs/` 逐文件考古；`documents/INDEX.md` 仅收录 5/30 个蓝图。
2. **头部元数据缺失/不统一**：29/30 文件无标准头部；现存格式 4 种以上，多数文件连创建日期都缺失。
3. **头部状态与现实脱节**：3 个文件头部滞后（task-lens-m1 头部「待实施」实际 PHASE-05 已 ACCEPTED；v3 头部冻结在批准前状态实际已 formal ACCEPT；phase-progression 头部「待实施」实际机制已经其他线落地）。
4. **暂停链无记录**：实际开发中多次出现「蓝图1 执行 → 遇到新问题阻断 → 暂停 → 创建蓝图2 解决 → 蓝图2 又受阻 → 创建蓝图3」的链式暂停，但蓝图间因果关系无任何元数据记录，阻断蓝图闭环后被暂停蓝图无人唤醒。
5. **停滞文件无退役机制**：10 个文件实质停滞/过时（ACP 全线 7 个 + 2 个 06-29 快照 + 1 个 session 交接摘要）无任何废弃记录；2 个被取代文件混在活跃目录。
6. **非 blueprint 文档混入**、命名不统一（`blueprint-*` 前缀 21 个 vs 无前缀 9 个）、创建日期语义混乱（19 个文件在 repo init 批量入库，git 日期 ≠ 写作日）。

### 1.2 根因分析

**直接原因**：目录只有「创建」环节（blueprint-creation skill），缺少「状态维护 / 退役 / 归档」环节；状态真相分散在 `audits/*/LATEST.md`，不回写到蓝图。

**根本原因**：缺少蓝图生命周期模型（状态词汇表、状态真相源、因果边元数据）与防漂移机制（lint / 扫描）；`logs-governance` 已验证的 INDEX + `archive/YYYY-MM/` 治理模式未延伸到 `blueprints/`。

### 1.3 实测验证

2026-07-28 三轮只读调查（工作区 `check-plan` worktree）：

- `Verified-by: git log --follow --diff-filter=A × 30 文件 + git branch --contains f8e60fa → 19 文件归属 repo init 提交（2026-07-12），创建日以头部自述为准`
- `Verified-by: head audits/*/LATEST.md × 7 → v3 ACCEPTED / v1 ACCEPT / P0-2 全 8 阶段 ACCEPT / task-lens PHASE-05 ACCEPTED 等 verdict 直读，与头部状态比对发现 3 处脱节`
- `Verified-by: rg -l --fixed-strings <basename> × 30 文件 × 7 维度 → 归档候选 11/11 在 audits//plans/ 引用为 0（context-lazy-loading、permission-template-refactor 另有 .agents//logs/ 非阻断引用，归档时 INDEX 注明）；v3 ×34 / simplification-roadmap ×26 / isolated-serve ×22 高引用`
- `Verified-by: rg -B1 -A2 'blueprint' audits/audit-governance-evidence-and-status-closure-v3/phase-01-scope-lock.yaml → :40-42 authority_binding.blueprint.sha256 = a510b7a8...（v3 蓝图被 SHA-256 冻结绑定）`
- `Verified-by: rg blueprints/ scripts/ .agents/skills/ --glob '*.ts' → 零命中（无脚本扫描本目录）`
- 暂停链实例：`blueprint-phase-progression-audit-gate`（07-24，需可信 audit 输入无法启动）→ 创建 closure v1（07-25，其 :74 自述提供该输入）→ v1 phase-01 审计 INVALID（AUDIT-GOV-PHASE-01-R2-INVALID-01）→ 创建 closure v3（07-26，clean-slate）→ v3 全链 ACCEPT（07-28）→ phase-progression 机制经 v3 工具链落地。

**结论**：问题是治理机制缺失，不是个别文档质量问题。

---

## 二、解决方案

### 2.1 方案概述

| 维度 | 方案 A：全量时间分层 | 方案 B：两层模型 + 元数据治理（选定） | 方案 C：仅建 INDEX 看板 |
|------|---------------------|--------------------------------------|------------------------|
| 核心思路 | 全部文件按日期移入 `YYYY-MM/` 子目录 | 活跃文件平铺 + `archive/YYYY-MM/` 归档层 + 四字段元数据 + 单源状态 + lint | 只加索引，不动文件 |
| 引用破坏 | 破坏 31 处冻结 provenance 记录（v3 蓝图 path+SHA 被 scope-lock 绑定，移动即破坏审计链） | 11 个归档候选 audits//plans/ 引用 11/11 为 0，活跃文件零移动 | 零破坏 |
| 根治头部漂移 | 否 | 是（M5 单源 + M4 规范 + M8 lint） | 否 |
| 退役机制 | 无 | 有（M6 + 归档层） | 无 |
| 实施成本 | 高且不可行 | 中（纯文档操作 + 1 个 lint 脚本） | 低 |

**选择结论**：方案 B。可行性边界经实测确认：日期子文件夹只能以归档层存在（活跃层被冻结引用硬性锁定），归档层成本≈0。

**否决理由**：
- 方案 A：v3 等 5 个高引用文件的路径/SHA 被冻结 scope-lock/approval 以 hash-bound 形式记录（`audits/...-v3/phase-01-scope-lock.yaml:40-42`），移动即破坏审计链，硬性不可行。
- 方案 C：不解决头部漂移（无回写规范与 lint）、不解决停滞噪音（无退役归档）、不解决暂停链无记录（无元数据字段），治标不治本。

### 2.2 核心设计

#### 2.2.0 措施索引（M1-M10）

| 措施 | 阶段 | 内容 | 详见 |
|------|------|------|------|
| M1 | P0 | 建立 `blueprints/INDEX.md` 三段式看板 | §2.2.5 |
| M2 | P0 | `archive/YYYY-MM/` 归档层 + 11 文件归档 | §2.2.1 / §2.2.6 / §2.2.7 |
| M3 | P0 | 存量头部 backfill（四字段 + 因果边 + 脱节修正 + Superseded-by） | §2.2.7 |
| M4 | P1 | 头部元数据规范（四字段 + 七值状态 + 三类因果边 + 单边记录） | §2.2.2 / §2.2.3 / §2.2.4 |
| M5 | P1 | 状态真相源单源化（audits/LATEST.md）+ 冻结快照规则 | §2.2.3 |
| M6 | P1 | 退役流程 + 移动禁令 + 修改禁令（fail-closed） | §2.2.1 / §2.2.6 |
| M7 | P1 | 命名规范 + 创建登记（`blueprint-<topic>.md` + INDEX 同行登记日期依据） | §2.2.8 规范同步 |
| M8 | P2 | 漂移 lint（`scripts/check-blueprint-status.ts`，9 项检查） | §2.2.8 |
| M9 | P2 | 停滞扫描 + 唤醒扫描 | §2.2.6 / §2.2.8 |
| M10 | P2 | 治理归属（blueprints/INDEX 维护义务 + documents/INDEX 同步） | §2.2.8 规范同步 |

#### 2.2.1 目录两层模型

```
blueprints/
├── INDEX.md                    # 状态看板（活跃 / 已闭环 / 已归档三段）
├── <活跃文件>.md                # 待审批/待实施/实施中/已完成闭环：平铺，路径永久稳定
└── archive/
    ├── 2026-06/                # 已退役文件，按写作月归档
    └── 2026-07/
```

**移动禁令**：被 `audits/` 冻结记录（scope-lock/approval/receipt）或活跃 `plans/` 以路径引用的文件永不移动，原位标记「已退役」。
**修改禁令**：回写任何头部前，必须 `rg` 检查该文件 path/SHA 是否出现在任何冻结 scope-lock/approval/receipt 中；命中 → 禁止改文件，元数据仅写入 INDEX 豁免清单（实测命中：closure v3）。
**归档月份**：按文件自身写作月，非归档操作当前月（对齐 logs-governance §B3）。

#### 2.2.2 头部元数据规范（四字段，强制）

```markdown
**创建日期**: YYYY-MM-DD
**更新日期**: YYYY-MM-DD
**状态**: <七值之一>
**相关蓝图**: 无 | <类型化边列表>
```

- **创建日期**：头部自述写作日；无自述时回退 git 首次入库日，INDEX 登记日期依据。
- **更新日期**：头部或内容最后变更日；lint 以 `git log -1 --format=%ad -- <file>` 机械比对。
- **冻结快照规则**：蓝图进入首个 plan 冻结契约后，头部即快照（更新日期=冻结日期），此后状态/边变更只投影到 INDEX，不回写文件。

#### 2.2.3 状态词汇表与状态真相源

七值状态：`草稿 / 待审批 / 待实施 / 实施中 / 已暂停 / 已完成 / 已退役`。「部分实施/返工中」归入「实施中」+ INDEX 备注列。

**`已暂停` 强制规则**：必须伴随非空「暂停于」边（lint 强制），防止无因暂停。

**状态真相源单源化**：有下游 plan/audit 的蓝图，状态以 `audits/<plan>/LATEST.md` 为唯一真相源；蓝图头部与 INDEX 均为投影。头部回写时机 = audit ACCEPT 签发 / plan 关闭 / 退役裁决三个事件点。

#### 2.2.4 「相关蓝图」因果边（最小词汇表）

| 边类型 | 语义 | 存量实例 |
|--------|------|---------|
| `暂停于 → X` | 执行中发现 X 所解决的问题阻断实施，暂停等待 X 闭环 | （历史：phase-progression 链；当前无活跃实例） |
| `前置依赖 → X` | 未启动，等待 X 提供输入 | phase-progression-audit-gate → closure v3 |
| `被取代 ← X` | X 接管本蓝图目标（含机制吸收、clean-slate 重启） | refactor ← driven-enforcement；v1 ← v3；agent-read ← driven-enforcement |

五条使用规则：

1. **只记因果边**（暂停/依赖/取代）；「参见/关联」类信息性引用留在正文，不入字段。
2. **单边记录**：边只写在依赖方/暂停方/被取代方一侧；INDEX 自动派生反向视图（"X 闭环 → 可唤醒 Y"），消除双写漂移。
3. **空值合法**：无因果边写 `相关蓝图: 无`。
4. **暂停先建蓝图**：暂停前必须已创建解决阻断问题的蓝图；阻断若非蓝图（如 debt 记录），状态保持 `实施中`，字段留空。
5. 边目标必须是存在的蓝图文件（lint 校验）。

#### 2.2.5 blueprints/INDEX.md 看板

三段式结构（对齐 logs-governance 模式）：**活跃 / 已闭环 / 已归档**。每行登记：文件 | 状态（七值）| 状态真相源指针（audits LATEST 或「头部自述-未独立验证」）| 日期依据（写作月 / 入库月）| 备注。附加两个派生区段：**反向边视图**（由单边边自动派生，服务唤醒扫描）与**豁免清单**（修改禁令命中文件，如 closure v3）。

#### 2.2.6 退役流程

1. 退役裁决：停滞（M9 扫描暴露，14 天无对应 logs/audits 新条目）或取代关系确认。
2. 记录：写一条 `logs/` 决策日志（为什么退役、被谁取代、是否归档）。
3. 归档前检查（fail-closed）：`rg --fixed-strings <basename> audits/ plans/` 双侧引用检查，任一命中或检查失败 → 不归档，原位标记。
4. 归档：`mv` 至 `archive/<写作月>/`，输出归档/跳过清单供人工确认。
5. 同步：INDEX 从活跃段移到归档段，必要时同步 `documents/INDEX.md`。

#### 2.2.7 存量处置（30 文件）

| 处置 | 数量 | 文件 |
|------|:---:|------|
| 保留 root-已闭环 | 5 | blueprint-dispatch-db-canonical、blueprint-question-hybrid-enforcement、blueprint-impact-analysis-framework、target-structure、blueprint-audit-governance-evidence-and-status-closure-v3（移动禁令保护，INDEX 标注头部为 freeze 快照） |
| 保留 root-实施中 | 9 | blueprint-opencode-framework-simplification-roadmap、blueprint-isolated-serve-test-infrastructure、blueprint-tool-governance-mvc-refactor、blueprint-dispatch-scope-privilege、blueprint-permission-template-driven-enforcement、blueprint-serve-api-session-tree-optimization、blueprint-todowrite-driven-weak-agent-supervision、blueprint-task-lens-m1（头部回写：实际 PHASE-05 ACCEPTED）、2026-07-12-framework-deprecated-content-audit-blueprint（P2 残留项先裁决再定去留） |
| 保留 root-待实施 | 2 | blueprint-dynamic-path-resolution、blueprint-cognitive-defense-skill-alignment |
| 头部回写后转已闭环 | 2 | blueprint-phase-progression-audit-gate（补 `前置依赖 → closure v3（已满足）`，状态→已完成）、blueprint-agent-read-enforcement（补 `被取代（机制吸收）← blueprint-permission-template-driven-enforcement`，状态→已完成） |
| 原位标记已退役 | 1 | blueprint-audit-governance-evidence-and-status-closure（v1，补 Superseded-by: v3；被 v1 plans/ 路径引用，暂缓归档） |
| 归档 `archive/2026-06/` | 5 | session-context-2026-06-28、acp-integration-direction、acp-protocol-verified、context-lazy-loading-plan、phase4-scripts-purification（无自述日期 → 入库月，INDEX 标注） |
| 归档 `archive/2026-07/` | 6 | acp-bridge-design、acp-bridge-serve-api-redesign（无自述日期 → 入库月，INDEX 标注）、blueprint-acp-bidirectional、blueprint-acp-bridge-optimization-roadmap、blueprint-acp-bridge-sse-events、blueprint-permission-template-refactor（占位文件，取代关系 INDEX 登记） |

处置后：root 活跃 19 个，`archive/2026-06/` 5 个，`archive/2026-07/` 6 个。

**backfill 范围规则**：归档文件不做头部 backfill（退役文件元数据以 INDEX 为唯一登记处，避免无价值改动并缩小修改禁令风险面）；root 19 文件中 18 个回写四字段，closure v3 豁免（INDEX-only）。

#### 2.2.8 防漂移机制

**M8 漂移 lint**（新脚本 `scripts/check-blueprint-status.ts`，component 级）：

1. 四字段存在性；2. 状态值 ∈ 七值词汇表；3. `已暂停 ⇒ 暂停于边非空`；4. 边目标文件存在；5. 暂停链无环；6. 更新日期 vs git 最后提交日（豁免文件跳过）；7. INDEX 反向派生视图与单边边一致；8. INDEX 三段登记与实际目录文件集合一致；9. 归档文件不被活跃 plans//audits/ 新引用。

**M9 停滞 + 唤醒双扫描**：活跃段「实施中」条目超 14 天无对应 logs/audits 新条目 → 停滞候选，交 M6 裁决；蓝图闭环（ACCEPT/已完成）时沿 INDEX 反向边视图列出所有 `暂停于/前置依赖` 它的蓝图 → 唤醒候选清单。

**规范同步**：blueprint-creation skill 模板头部加入四字段与状态词汇表；`blueprint-<topic>.md` 命名规范；新建蓝图必须 INDEX 同行登记；AGENTS.md §3 目录图与 §11 同步补 blueprints/INDEX 维护义务。

#### 2.2.9 子系统合规审计

本蓝图作用于 QoderWork 文档层，不修改 work-one 框架。逐项审计：

| # | 子系统 | 状态 | 检查要点 |
|---|--------|:---:|----------|
| 1 | MVC Architecture | N/A | 不改 work-one 代码；lint 脚本为纯读取判定，不写业务状态 |
| 2 | DB-only & DB-canonical | N/A | 不触及任何 DB |
| 3 | Permission Matrix | N/A | 不改 agent 工具权限 |
| 4 | Concurrency Safe | ✅ | P0 文档操作单批次串行，无并发写；归档 mv 逐文件串行 |
| 5 | Hardened Enforcement | ✅ | 新增约束（M6 禁令、M8 lint）作用于 qoderwork 文档层，与 work-one 硬门（如 FRAMEWORK_SKILL_READ_HARD_GATE）无交集 |
| 6 | Framework Harness | N/A | 不触及 harness |
| 7 | Central State Management | ✅ | M5 状态真相收敛至 audits/LATEST.md 单源，正是本原则应用 |
| 8 | Multi-Agent | N/A | 不改调度 |
| 9 | Log Central Management | ✅ | M6 退役强制写 logs/ 决策记录（§11.1） |
| 10 | DB-canonical Management | N/A | 无 schema 变更 |
| 11 | Templatization & Parameterization | ✅ | INDEX 模板化（对齐 logs-index-template）、四字段模板化入 blueprint-creation skill；归档月份等参数集中定义 |
| 12 | TypeScript + Bun Runtime | ⚠️ | M8 lint 脚本必须 TypeScript + Bun、禁止新增 npm 依赖、纳入根 tsconfig strict（tsc --noEmit）；文件行数遵守既有约定 |

---

## 三、实施清单

### 3.1 文件变更列表

| 序号 | 文件 | 变更类型 | 说明 |
|------|------|---------|------|
| 1 | `blueprints/INDEX.md` | 新建 | 三段式看板 + 反向边视图 + 豁免清单，首版登记 30 文件 |
| 2 | `blueprints/archive/2026-06/` | 新建目录 | 移入 5 个退役文件 |
| 3 | `blueprints/archive/2026-07/` | 新建目录 | 移入 6 个退役文件 |
| 4 | root 18 个待回写蓝图 | 修改 | 头部 backfill 四字段（逐个先过修改禁令检查）；含 task-lens-m1 状态修正、phase-progression / agent-read 状态与边、closure v1 Superseded-by（含原位退役的 closure v1） |
| 5 | `blueprints/blueprint-audit-governance-evidence-and-status-closure-v3.md` | 不改 | 修改禁令命中（SHA 冻结绑定），元数据仅入 INDEX 豁免清单 |
| 6 | `.agents/skills/blueprint-creation/SKILL.md` | 修改 | 模板头部加四字段、状态七值、命名规范、归档与禁令说明 |
| 7 | `AGENTS.md` | 修改 | §3 目录图补 INDEX/archive；§11 补 blueprints/INDEX 维护义务 |
| 8 | `documents/INDEX.md` | 修改 | 蓝图条目与阅读建议同步 |
| 9 | `scripts/check-blueprint-status.ts` + `__tests__/` | 新建（P2） | M8 lint 与组件测试 |
| 10 | `logs/YYYY-MM-DD-*.md` | 新建 | 每批次变更日志 + 每条退役决策记录（§11.1） |

### 3.2 实施步骤

**P0：一次性盘点清理（纯文档，单批次可回滚）**
1. 创建 `blueprints/INDEX.md`（首版 = 存量分类表，含日期依据与真相源指针）
2. 11 个归档候选逐文件执行归档前引用检查 → `mv` 至对应月份目录 → 输出归档/跳过清单
3. root 18 个活跃文件头部 backfill（每个先执行修改禁令 rg 检查，命中则改登记 INDEX 豁免）
4. 写 P0 批次变更日志与退役决策日志

**P1：建制（规范落地）**
5. blueprint-creation skill 模板同步（四字段、七值状态、命名、归档规则）
6. AGENTS.md / documents/INDEX.md 同步

**P2：防复发（自动化）**
7. `scripts/check-blueprint-status.ts` + 组件测试（bun:test）
8. M9 扫描接入会话启动检查或审计 finalize 环节

**下游治理要求**：本蓝图实施计划必须走 audit-chain v3；plan 索引按 P-01 声明 `provenance_level`（建议 `v3-required`）；凡 Fixed verification 含 `capture-state.ts --repository-root`，按 P-07 必须指向 work-one 干净锚点（`/home/zhaoge/workspace/opencode/work-one`），禁止指向 qoderwork 主仓或其 worktree；实施工作区为 qoderwork 相应 worktree。

---

## 四、验证计划

### 4.1 单元测试（P2 lint 脚本，bun:test）
- [ ] 字段缺失检出（缺任一四字段即报警）
- [ ] 非法状态值检出（不在七值集合）
- [ ] `已暂停` 无「暂停于」边检出
- [ ] 边目标文件不存在检出
- [ ] 暂停链成环检出
- [ ] 更新日期与 `git log -1` 漂移检出（豁免文件正确跳过）
- [ ] INDEX 反向派生视图与单边边不一致检出
- [ ] INDEX 登记集合与实际目录不一致检出

### 4.2 集成测试
- [ ] 归档前引用检查：11 个候选逐文件 `rg --fixed-strings <basename> audits/ plans/`，全部零命中或按 fail-closed 跳过并记录
- [ ] 修改禁令检查：18 个 backfill 目标逐文件 `rg` path/SHA 检查冻结记录，命中者登记豁免（预期 closure v3 命中）
- [ ] INDEX 三段与目录实况一致：`find blueprints -maxdepth 1 -name '*.md'` 与活跃+已闭环段集合相等；`find blueprints/archive -name '*.md'` 与归档段相等
- [ ] 归档后断链检查：活跃文件中对归档文件的 markdown 链接为零（文本提及允许，INDEX 注明新位置）

### 4.3 端到端测试
- [ ] N/A（纯文档治理，无运行时组件）；P0 完成后人工抽查：3 个归档文件新位置可读、旧位置不存在、INDEX 记录可对应

### 4.4 子系统合规验证
- [ ] 子系统 12（TypeScript+Bun）：`tsc --noEmit` PASS（含新 lint 脚本）；`bun test` PASS；`git diff bun.lock` 为空（无新依赖）
- [ ] 子系统 9（日志集中）：P0/P1/P2 每批次均有 logs/ 条目，退役决策记录齐全
- [ ] 子系统 7（状态收敛）：lint 验证 INDEX 状态与 audits/LATEST.md verdict 无冲突（对已有 audit 的 7 个 plan）

---

## 五、风险与缓解

### 5.1 风险

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 移动禁令误判（漏查路径引用） | 归档后活跃 plans/audits 引用断裂 | 归档前 rg 双侧检查 + fail-closed 跳过 + 归档/跳过清单人工确认 |
| backfill 破坏未知冻结绑定 | 审计链 hash 校验失败 | 修改禁令逐文件 rg 检查，命中即 INDEX-only（closure v3 已实测命中） |
| v1 plans 长期不关闭 | closure v1 永久占位 root | 原位标记可接受；M9 周期暴露；或由治理链正式关闭后一族归档 |
| 无自述日期文件归档月争议 | 归档依据不透明 | INDEX「日期依据」列强制登记（写作月 / 入库月回退） |
| INDEX 与实况漂移 | 看板失信 | M8 lint + M10 同步义务；新增/状态变更/归档后强制同步 |
| 头部回写被滥用（绕过冻结） | provenance 失效 | 冻结快照规则 + 修改禁令写入本蓝图与 skill 模板，lint 强制 |

### 5.2 回滚方案

P0/P1/P2 各自成批次、纯文档操作：单批 `git revert` 即可回滚；归档移动可逆（`mv` 回原位 + INDEX 回滚）；lint 脚本为新增文件，删除即回滚。所有批次不涉及 work-one，无运行时回滚需求。

---

## 六、成功标准

- [ ] `blueprints/INDEX.md` 建立，30/30 文件登记（状态 + 真相源指针 + 日期依据），三段式齐备
- [ ] root 活跃文件 = 19；`archive/2026-06/` = 5、`archive/2026-07/` = 6；归档前引用检查 11/11 有记录（PASS 或 fail-closed 跳过）
- [ ] root 18 个可写文件四字段齐全；closure v3 及任何修改禁令命中者登记于 INDEX 豁免清单
- [ ] 3 条活跃文件 backfill 边写入并过 lint（closure v1 被取代、phase-progression 前置依赖、agent-read 被取代·机制吸收）；task-lens-m1 等 3 处脱节头部修正
- [ ] M8 lint 组件测试全 PASS，且对实施终态零漂移报警
- [ ] 每条退役/归档均有 logs/ 决策记录；P0/P1/P2 批次日志齐全
- [ ] `documents/INDEX.md` 与 `AGENTS.md` §3/§11 同步更新

---

## 七、附录

### 7.1 相关文件
- `.agents/skills/logs-governance/SKILL.md` - INDEX + `archive/YYYY-MM/` 模式先例（本蓝图为该模式首次实例化）
- `.agents/skills/blueprint-creation/SKILL.md` - 蓝图模板标准来源（P1 需同步）
- `.agents/skills/plan-audit-archiver/provenance-rules.md` - P-01~P-07（下游 plan 治理要求）
- `blueprints/blueprint-audit-governance-evidence-and-status-closure-v3.md` - plan/audit-phase 治理蓝图（本蓝图治理边界参照，见 §0）
- `audits/*/LATEST.md` - 状态真相源
- `logs/INDEX.md` / `documents/INDEX.md` - 索引同步义务方

### 7.2 参考资料
- 2026-07-28 三轮只读调查证据（见 §1.3 各 Verified-by 行）：30 文件创建日期表、进度分类、引用计数矩阵、冻结绑定证据、暂停链实例
