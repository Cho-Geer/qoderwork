# 死代码清理：移除 isWriteAllowed

**为什么**: isWriteAllowed 是 per-agent 写权限检查的 deprecated 函数，零 runtime caller、零测试依赖，是 dead 代码清理链的第一个符号。

**改了什么**:
- `.opencode/service/gate/checks.ts` — 删除 `isWriteAllowed()` 函数定义（138-140行）及前置注释块（131-136行）
- `.opencode/service/gate/index.ts` — 删除 barrel re-export `isWriteAllowed,`（原82行）
- `.opencode/lib/gate-checks.ts` — 删除 bridge re-export `isWriteAllowed,`（原8行）

**决策**: 直接删除，无需迁移。函数体仅委托给 `isPathAllowedForAgent(agentType, filePath, "safe_edit")`，无独立逻辑。grep 确认仅剩 `permission/reader.ts:178` 的注释引用（无需修改）。79 tests PASS（permission-equivalence + compliance-gate-bypass + framework-e2e + safe-bash-core + codegraph + tool-governance-handler），0 fail。
