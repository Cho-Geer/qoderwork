# 死代码清理：移除 logAuditEntry + flushAuditTrail + 4 个 dead import

**为什么**: logAuditEntry 和 flushAuditTrail 的唯一 caller executeWriteAuditCheck 已在上一轮删除，二者成为新 dead 代码。随后发现 audit.ts 中 4 个 import 也因 executeWriteAuditCheck 删除而变为 dead。

**改了什么**:
- `.opencode/service/file-guard/audit.ts`：
  - 删除 `logAuditEntry()` 函数体（25-27行）
  - 删除 `flushAuditTrail()` 函数体（29-33行）
  - 清理 import：移除 `shouldBlock`、`atomicWriteSubState`、`isPathAllowedForAgent`、`dbFlushAuditTrail`（4 个 dead import）
  - 保留 `writeLog`、`dbWriteAuditLogEntry`（被活跃的 `writeAuditLogEntry` 和 `recordWriteAudit` 使用）
- `.opencode/service/file-guard/index.ts` — 第 65 行改为仅 `export { writeAuditLogEntry } from "./audit"`
- `.opencode/lib/audit-log.ts` — 第 5 行改为仅 `export { writeAuditLogEntry } from "../service/file-guard/audit"`

**决策**: 100 tests PASS（从上周 4 fail 降为 3 fail，A5 测试自行变绿），0 regression。剩余的 `db-state-manager.ts:813` 注释提及 flushAuditTrail 是无害文档残留，不阻塞删除。
