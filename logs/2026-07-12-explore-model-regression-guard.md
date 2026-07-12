# 修复 explore 子会话模型回退并加回归护栏

**为什么**: `ses_0ae760563ffeJi2ZY8KTbGFqJq` 派出的 `@explore` 子会话实际跑在 `opencode-go/glm-5.2`，上游 provider 返回 400（`Extra inputs are not permitted, field: 'native'`），导致子会话 0 token、空 task_result。该问题此前已修过，但工作树把 `explore.model` 回退了。

**改了什么**:
- `work-one/opencode.json` — 将 `agent.explore.model` 从 `opencode-go/glm-5.2` 恢复为 `opencode-go/deepseek-v4-pro`
- `work-one/AGENTS.md` — 对齐实际运行态说明，更新 explore 的模型描述
- `work-one/.opencode/lib/__tests__/native-agent-models.test.ts` — 新增回归测试，锁定 explore 不得回退到 `glm-5.2`

**决策**: 采用“配置修复 + 文档对齐 + 独立测试护栏”的最小改动方案，不触碰当前工作树其他并行变更；验证使用 `/home/zhaoge/.bun/bin/bun test .opencode/lib/__tests__/native-agent-models.test.ts`。
