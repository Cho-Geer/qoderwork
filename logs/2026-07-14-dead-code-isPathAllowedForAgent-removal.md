# 死代码清理：移除 isPathAllowedForAgent + 相关测试

**为什么**: isPathAllowedForAgent 的唯一两个 runtime caller（isWriteAllowed、executeWriteAuditCheck）已在前序步骤删除，函数成为新 dead 代码。per-agent 路径检查在 Phase 3 已转向 behavior-based enforcement。

**改了什么**:
- `.opencode/service/gate/checks.ts` — 删除第 8 行 `import { isPathAllowedForAgent }`（isWriteAllowed 删除时的遗漏残留）
- `.opencode/service/permission/reader.ts` — 删除 `isPathAllowedForAgent()` 函数体（178-232行，55行）
- `.opencode/service/permission/reader.ts` — 更新第 115 行注释，移除已删除的 caller 名
- `.opencode/lib/__tests__/permission-equivalence.test.ts`：
  - 删除 import 中的 `isPathAllowedForAgent`
  - 删除 "Write scope equivalence" describe 块（34-70行，16 个测试用例）
  - 删除 "Agent coverage" 中第 216 行 isPathAllowedForAgent 断言
  - 更新注释编号 2-6→1-5

**决策**: P1 #4 dead 代码清理链（isWriteAllowed→executeWriteAuditCheck→logAuditEntry/flushAuditTrail→PermissionIsolation→isPathAllowedForAgent）全部闭环。5 个符号 5 个整文件删除，共 ~456 行，108 tests PASS，零 regression。
