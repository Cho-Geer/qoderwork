# 遗留任务优先级执行进度（模型切换前固化）

**为什么**: 按优先级执行 work-one 框架遗留任务，切换对话模型前固化进度便于新模型接续。

## 已完成

### P0 #1: 修复 plan->Meta-Planner stale 映射 ✅
- 删除 `agent-identity.ts` DISPLAY_NAMES 的 `plan: "Meta-Planner"` 条目
- bun 实测：5 active agent 全部走 opencode.json，plan 的 safe_shell 从 `{"*":"allow"}` 恢复为 `deny`
- 测试回归：`safe-bash-core.test.ts` + `permission-equivalence.test.ts` 全 PASS

### P0 #2: tool-governance Phase 8/9 验证 + checkbox ✅
- 代码审核确认 Phase 8（3 bug）+ Phase 9（3 安全绕过）全部已修复（blueprint 原标 🔴 未实施，更正为 ✅）
- 验证：codegraph.test.ts 9/9 + write-bypass 5/5 + 治理域 41/41
- 勾选 §5.1(5) + §5.2(4) + §7(12) 共 21 个 checkbox

## 进行中

### P1 #3: getAgentShellAllowlist 行为型迁移 — Blueprint 已完成，代码待实施
- 新增 `blueprints/blueprint-permission-template-driven-enforcement.md`，采用 default/trusted/confirm 命名模板。
- 实测确认绑定必须使用 `opencode.json.agent.*.options.permission_template`；direct `agent.permission_template` 不进入 OpenCode 1.17.18 resolved config。
- Phase 1：default+trusted、3 个生产 caller 清零、dangerous bypass 退役；Phase 2：confirm/repo_read、legacy-agent-permissions 退役。
- 当前证据：CodeGraph impact 15 symbols；targeted baseline 52/52 PASS；live safe_shell session `ses_0a1c52ebdffe98AUmnRzAdsMEh` PASS。

### P1 #4: dead 代码清理 ✅ 全部完成
- isWriteAllowed ✅：删 3 处（checks.ts + gate/index.ts + lib/gate-checks.ts）
- executeWriteAuditCheck ✅：删函数体(95行) + 整文件 write-audit-lib.ts
- logAuditEntry+flushAuditTrail ✅：删 2 函数 + 4 dead import + 2 barrel re-export 清理
- PermissionIsolation ✅：删 4 整文件(222行) + 3 处 re-export 清理
- isPathAllowedForAgent ✅：删函数(55行) + 清残留 import + 删 16 测试用例
- **合计**：5 整文件删除，~456 行，108 tests PASS，零 regression
- Handler 收敛测试修正 ✅：framework-e2e.test.ts 3→1 fail

### 下一步
- 按权限模板 blueprint 实施 P1 #3 Phase 1；完成 runtime allow+deny smoke 后再关闭 #3。

## 完整 Todo List（按优先级）

### P0（已完成）
1. ✅ 修复 plan->Meta-Planner stale 映射（agent-identity.ts）
2. ✅ tool-governance Phase 8/9 checkbox 验证 + 勾选

### P1（高 ROI 收口 + dead 清理）
3. **getAgentShellAllowlist 3 个 active caller 迁移到行为型**（permission-policy.ts / shell-guard.ts / shell-config.ts）- per-agent 退役核心前置，2-3d
4. **dead 代码清理**（进行中）：isWriteAllowed(进行中) -> executeWriteAuditCheck -> PermissionIsolation -> isPathAllowedForAgent，1d
5. **legacy-agent-permissions.ts 退役**（905 行 deprecated fallback），依赖 #3，0.5d
6. **dispatch-validate.ts + before/dispatch.ts legacy 归档**，0.5d
7. **router.ts:235 auto_plan 硬编码 "Meta-Planner" 收口**，0.5d
8. **shell-targets.ts 等 untracked 文件纳入 git**，0.5d
9. **SSEWatcherFd WSL2 监控缺陷修复**，1d

### P1/P2（E2E 补齐）
10. Phase 7 allow-path live E2E（资源上限、中断、进程树终止），2d
11. gh remote_write 变体 E2E（L3-008~011），1-2d
12. question enforcement full-runtime closure，1d
13. /children fallback HTML/non-JSON 故障注入，0.5d

### P2（质量回归 + 配置收口）
14. 中英文关键词不一致 F1-F4 修复，1d
15. agent_domain_map 补 native agent 名，0.5d
16. weak-model 23 场景 runtime 回归，2d
17. 日志字段统一（旧 gate JSONL ruleId/layer/outcome），1d
18. scope-validate.ts 拆分，1d
19. MCP role filter 接线或废弃，0.5d
20. final-validation-report 补强，1d

### P3（长尾）
21. 惰性 DB 副本清理，0.5d
22. DB hot-path 统计后表合并，1d
23. agent-identity.ts AGENTS 常量清理，0.5d

## 关键依赖链
#1,#2(已完成) -> #4(dead 清理) -> #3(getAgentShellAllowlist 迁移) -> #5(legacy-agent-permissions 退役) + #16(weak-model 回归)

## 审核发现的文档漂移（已更正）
- tool-governance Phase 8/9：🔴 未实施 -> ✅ 已实施（代码已修）
- isWriteAllowed：文档说有 caller -> 实际零 caller（dead）
- dispatch_subagent：文档说未退场 -> 普通路径已 retired
- 基线数字：TS 372->388、行数 75,563->77,728、tools 37->39
- plan->Meta-Planner 映射：plan 权限走 legacy fallback（safe_shell 配置 deny 实际 allow-all）

## 决策
- P0 两个任务已完成验证。P1 #4 从最简单的 isWriteAllowed 开始（零测试依赖）。
- per-agent enforcement active 存活入口仅 getAgentShellAllowlist（3 active caller）+ findRouteAgentForFile（经 active scope handler）。
- 新模型接续：读 AGENTS.md -> ls logs/ -> 读本文件 -> 读 todo list -> 继续 P1 #4 步骤。
