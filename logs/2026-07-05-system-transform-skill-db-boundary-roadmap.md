# System Transform、Skill 注入与最小 DB 边界

**为什么**: 用户同意继续小幅更新路线图，需要把 system transform 降级为增强通道，补充 Skill 自动注入风险边界，修正 Skill 数量，并明确不是无 DB 而是最小状态。

**改了什么**:
- `blueprints/blueprint-opencode-framework-simplification-roadmap.md` — 升级为 v1.2.2，修正当前 Skill 数量为 18 个，新增 system transform 稳定性边界
- `blueprints/blueprint-opencode-framework-simplification-roadmap.md` — 新增 Skill 摘要优先注入原则、JSONL 优先审计、DB 仅保留 guidance/resume/audit index/long task trace 的最小状态原则

**决策**: `experimental.chat.system.transform` 只做增强，不做唯一核心路径；普通审计 JSONL 优先，DB 不做流程控制中心但保留桥接和恢复状态。
