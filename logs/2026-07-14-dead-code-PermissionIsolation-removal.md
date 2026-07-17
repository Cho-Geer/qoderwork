# 死代码清理：移除 PermissionIsolation（per-agent 权限模型）

**为什么**: PermissionIsolation 是 per-agent 权限模型的核类（硬编码 10 个旧角色 profile），零 runtime caller。Phase 3 已转向 behavior-based 检查，此类纯属 legacy 残留。

**改了什么**:
- `.opencode/service/permission/isolation.ts` — **整文件删除**（200行：类+接口+PERMISSION_PROFILES/DENIED_WRITE_PATTERNS 常量）
- `.opencode/service/permission/b6-permission-isolation.ts` — **整文件删除**（7行 stub，仅 return false）
- `.opencode/lib/permission-isolation-core.ts` — **整文件删除**（4行 bridge）
- `.opencode/lib/__tests__/permission-isolation-core.test.ts` — **整文件删除**（只测 dead 代码）
- `.opencode/service/permission/index.ts` — 删 dead re-export（行6-7）和 isolation 提及（行3）
- `.opencode/lib/index.ts` — 删 dead re-export（行22）和注释提及（行13）
- `.opencode/service/file-guard/critical-files.ts` — 删 isolation-core 保护条目（行144）

**决策**: 108 tests PASS，1 pre-existing fail（Orchestrator.md 行数），0 regression。保留的 active 导出：`service/permission/index.ts` → `b6-permission-reader`（isPathAllowedForAgent、getAgentPermission 等仍在活跃使用）。
