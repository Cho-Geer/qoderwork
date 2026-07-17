# 权限模板 Blueprint 的弱模型交付协议

**为什么**: 仅有通用弱模型任务卡不足以保证 P1 #3/#5 的测试设计、运行证据和完成判定；新建测试 Skill 也尚未部署到 work-one runtime，不能假设弱模型已读取。

**改了什么**:
- `blueprints/blueprint-permission-template-driven-enforcement.md` — 升级 v1.1.0，新增 runtime Skill 同步/认证、测试式样书先行、固定 task card、对抗测试与 reviewer Final Gate。
- 同一 blueprint 的实施清单/验证/风险/成功标准 — 增加 runtime discovery、SHA-256、independent oracle、mutation/fault/live evidence 的硬门。

**决策**: 采用“受约束实施者”协议，不依赖识别模型强弱；弱模型只交 patch 与证据，强审查模型/人工独占最终完成判定。任何 runtime Skill 缺失、attest 失败、无测试 oracle 或无执行证据均为 BLOCKED/INVALID，不能继续写入或标记完成。
