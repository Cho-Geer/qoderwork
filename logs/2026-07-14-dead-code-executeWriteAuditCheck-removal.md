# 死代码清理：移除 executeWriteAuditCheck

**为什么**: executeWriteAuditCheck 是写操作审计检查器，零 runtime caller、零测试依赖，是 dead 代码清理链的第 2 个符号（继 isWriteAllowed 之后）。

**改了什么**:
- `.opencode/service/file-guard/audit.ts` — 删除 `executeWriteAuditCheck()` 函数体（38-132行，95行）及前置注释块（36-37行）
- `.opencode/service/file-guard/index.ts` — 删除 barrel re-export `executeWriteAuditCheck,`（原65行，保留同行的 writeAuditLogEntry/logAuditEntry/flushAuditTrail）
- `.opencode/lib/write-audit-lib.ts` — **整文件删除**（5行，唯一作用是转发 executeWriteAuditCheck，零 importer）

**决策**: 直接删除。函数调用的 writeAuditLogEntry 仍被 gate/checks.ts、dispatch/dag-policy.ts、dispatch/router.ts 活跃使用，不可动。logAuditEntry 和 flushAuditTrail 同为 dead，留待后续清理。99 tests PASS，4 pre-existing fail（无关），0 regression。
