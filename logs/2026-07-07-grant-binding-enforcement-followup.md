# 框架重构后续：Question Enforcement 确认 + Grant 绑定修复 + Per-Agent 删除

**为什么**: P0 修复后，需要验证后续任务（Question enforcement、dispatch privilege 端到端、per-agent 清理、Scout smoke）的实际状态，修复发现的链路断裂。

**改了什么**:
- `.opencode/plugins/session.ts` — `onSessionCreated` 新增 grant binding 逻辑：子 session 创建时查找父 session 的 pending queue entry，按 dispatch_key 绑定 grant。这是新增的早期绑定路径；legacy `before/task.ts` 中的绑定已废弃，但 `marker-consume.ts` 在 dequeue 时仍保留独立的绑定路径（双路径并存，非迁移）
- `.opencode/opencode.json` — build agent permission 新增 `safe_framework_edit: "allow"`，使 build 子 agent 可调用受控框架写入工具
- `.opencode/service/dispatch/tool-scope-paths.ts` — 删除 `readDispatchAllowedTools()` 和 `isToolAllowed()`（0 runtime callers）；清理未使用的 `fs`、`STATE_PATHS`、`normalize`、`toDisplayName` 导入
- `.opencode/lib/tool-scope.ts` — 移除已删除函数的 bridge re-export
- `qoderwork/scripts/e2e-grant-lifecycle.ts` — E2E 测试脚本（17 PASS / 0 FAIL）
- `qoderwork/scripts/integ-grant-session-binding.ts` — 集成测试脚本（10 PASS / 0 FAIL）

**决策**:
- Question hybrid enforcement 代码变更已在之前 session 实施完毕（checkThreshold 从 system hook 调用、Phase 1 directive 使用 question、after-hook 检测 question recovery），本次确认为已完成
- `bindGrant` 在 `session.ts` 的 `onSessionCreated` 增加了一条**早期绑定路径**（子 session 创建即绑定，不等第一个 tool call）；同时 `marker-consume.ts` 在 dequeue 时仍保留另一条绑定路径。两条路径并存，非"迁移"关系
- `safe_framework_edit` 注册为 build agent 的 `"allow"` 权限，工具内部自行校验 grant + path
- `readDispatchAllowedTools` + `isToolAllowed` 在生产运行路径中无调用者，确认后直接删除（bridge re-export 同步移除）
- `PermissionIsolation` 类及其 test 依赖、re-export 链仍保留；"无生产运行调用"仅指 production runtime path，测试和 bridge 仍引用。其他 per-agent reader 函数（`isWriteAllowed`、`getAgentPermission`、`getAgentShellAllowlist`、`attestConfigRead`）仍在 runtime 被调用，需行为型替换而非直接删除
- **证据等级声明**：本节所述"PASS"均为 DB/函数级模拟验证；**live LLM dispatch E2E 尚未闭环**（待通过 serve API 创建真实 Orchestrator→build child→safe_framework_edit 链路验证）

## 验证结果

### E2E Grant Lifecycle（17 PASS / 0 FAIL）
| 测试 | 结果 |
|------|:----:|
| E2E-01: 无 grant session → hasGrant null | PASS |
| E2E-02: grant 全生命周期 6 项 | 6 PASS |
| E2E-03: dispatch exact binding 6 项 | 6 PASS |
| E2E-04: 并发 child 隔离 | 2 PASS |
| E2E-05: 过期 grant 拒绝 | PASS |
| E2E-06: 撤销 grant 拒绝 | PASS |

### Integration: Session Binding（10 PASS / 0 FAIL）
| 测试 | 结果 |
|------|:----:|
| Step 1-2: Grant pending 创建 | PASS |
| Step 3a-b: Queue entry 查找 + grant 绑定 | 2 PASS |
| Step 4-5: hasGrant + path 匹配 | 3 PASS |
| Step 6a-c: CodeGraph 双门模拟 | 3 PASS |
| Step 7: Grant 消费 | PASS |

### Scout Smoke
| 验证项 | 结果 |
|--------|:----:|
| 框架路由: resolveDispatchTarget("scout") | PASS |
| 关键词匹配: "调研" → scoutSuggested | PASS |
| Prompt marker: //NATIVE_EXECUTOR:scout | PASS |
| OpenCode runtime: scout agent 注册 | 依赖运行时 |
