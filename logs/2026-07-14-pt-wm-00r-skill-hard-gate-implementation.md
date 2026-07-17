# PT-WM-00R Skill 读取硬门返工实现

**为什么**: 修复 T-PT-004 gap：原 skill-policy 仅做 WARN/audit-only，不读取 DB 中的 skill_read_attest 状态，无法真正阻断未认证写操作；需要实现 DB-canonical 硬门，满足 Blueprint §2.2.7 契约。

**改了什么**:
- `.opencode/service/state/substate-types.ts` — 扩展 SkillReadState 类型，新增完整状态契约（session/agent/task_id/required_set_hash/files/verified/attested_at）
- `.opencode/service/session/skill-attest.ts` — 重写 attestSkillRead 实现：原子写入、失败失效旧状态、DB 写失败 fail-closed、SHA-256 文件哈希校验、新增 validateSkillAttestation() 用于运行时校验
- `.opencode/service/session/index.ts` — 导出新增的 validateSkillAttestation 函数和类型
- `.opencode/service/enforcement/rule-disposition.ts` — 新增 `skill-read-attest-required: "hard_block"` 规则
- `.opencode/plugin-handlers/before/skill-policy.ts` — 重写 handler：删除内存 Set/Map 状态，改为 DB 校验；固定 PRE_ATTEST_ALLOWLIST（仅8个工具）；其他所有工具/未知工具在未认证时硬阻断；异常可传播到 dispatcher
- `.opencode/plugins/before-dispatcher.ts` — 将 skill-policy 移到 tool-governance 之前，未认证调用提前失败
- `.opencode/project.config.json` — required_skill_reads 扩展为4个：preflight-lite、codegraph-first、requirements-to-test-specification、test-specification-execution
- 新增测试：`.opencode/service/session/__tests__/skill-attest.test.ts`（6个测试覆盖 T-PT-039/040/042）、`.opencode/plugin-handlers/before/__tests__/skill-policy.test.ts`（5个测试覆盖 T-PT-041/042/ADV-PT-008/T-PT-046）

**决策**:
1. 硬门仅通过环境变量 `FRAMEWORK_SKILL_READ_HARD_GATE=1` 启用，不写入弱模型可编辑的 project config，避免模型自行关闭约束
2. 未认证 allowlist 固定在代码中，不从配置/身份扩展，默认 fail-closed 阻断所有未知工具
3. 有效认证必须同时匹配 session/agent/task_id/required_set_hash/每个文件hash，任一变化即失效
4. 保留 checklist-incomplete 为 audit-only，不修改通用规则 disposition，仅新增专用硬门规则，避免误伤其他工作流
5. 异常不被 handler 自身 catch，确保阻断异常可到达 before-dispatcher

**验证结果**:
- 新增 11 个测试全部 PASS（100%）
- 现有基线 89 个测试（permission/shell/path/codegraph/tool-governance）全部 PASS，无回归
- 硬门关闭时保持向后兼容，不影响现有运行态行为
