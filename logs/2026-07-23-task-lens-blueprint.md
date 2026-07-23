# 2026-07-23 task-lens M1 blueprint 创建

## 为什么
AI 产出信息密度远超人审查带宽，缺一个按任务聚合的注意力分配产物。经五轮设计讨论收敛（缓冲带构想 → 交互函数画布 → 契约/inspector 两问 → 蓝图），决定先做 M1：全确定性管线的"任务透镜卡片"生成器。

## 改了什么
- 新建 `blueprints/blueprint-task-lens-m1.md`：问题根因（含 codegraph/inspector 实测证据）、方案 A/B/C 对比、七模块管线设计、12 子系统合规审计、实施清单（4 Phase 约 3 天）、三层验证计划、风险回滚、成功标准。
- 同日 v0.1.1：应用户反馈（新事物+AI 叙事风格难读）追加「八、设计图纸」——成品样例卡（work-one 真实函数）/流水线（各工位原料形态）/模块分层 Mermaid 三图，文首加读图指针。
- 同日 v0.1.2：应用户通用性要求，新增「2.4.0 通用性不变量 G1-G5」（只读语言级产物/目标项目零侵入/StructureProvider 接口隔离/项目差异收敛到 task-lens.config.yaml/coverage 契约绑定 lcov 格式而非生产者）；修订 spine 入口、coverage-reader 契约、副作用规则集、成功标准（加第二 TS 项目出卡验证）；定位改为"AI 开发中的函数粒度监测脚手架"。
- 同日 v0.1.3：实测 `bun --cpu-prof/--cpu-prof-md` 存在且输出调用树（functionName/children/hitCount + md 版 Call Tree/Called-by），**更正**此前"Profiler 缺席→观测边只能 coverage"的过时结论；附录新增「7.3 M2 运行时观测源备选」表（cpu-prof 调用树 / CDP 断点录参 / Runtime.evaluate 重跑 / ALS 异步关联 / diagnostics_channel 备选-UNVERIFIED）；M1 观测层维持 lcov-only。
- 同日 v0.1.4：蓝图新增「〇、路线图 M1→M2→M3 + 闸门判定」节（正式化 M2/M3 边界与解锁闸门，含 M1.5 可选项；按用户指示**不含**市面工具比较，维持既定方向）；读图提示更新指向 §〇；新建 `handoff/task-lens-resume.md` 跨 session 续接纪要（Q1-Q8 决策 + 工具重叠调查 + Option A/B/C 战略分叉 + 缺口清单 + 未决 UNVERIFIED）。

## 关键决策
- 建造顺序：先丑后美（M1 markdown 卡片 → M2 录制重放 → M3 画布，各有前置闸门）
- 管线零 LLM（方案 A）；LLM 叙事层降级为 M1.5 可选项，挂 narrative-lint 闸门
- 成效度量：轻量内建（卡片反馈区 + metrics.jsonl），验收 = 10 真实任务后回看
- 下游实施计划 provenance 建议 component-only

## 实测依据
- codegraph：4,424 节点/14,765 边；node 输出含位置/签名/调用关系，但边有噪声（→ edge-filter 硬需求）
- Bun inspector：Runtime.evaluate/Debugger 可用，Profiler 缺席（→ M2 观测边改用 coverage）

## 更新了什么文档
- 新建：blueprints/blueprint-task-lens-m1.md
- 新建：本日志
- 新建：handoff/task-lens-resume.md（跨 session 续接纪要）
