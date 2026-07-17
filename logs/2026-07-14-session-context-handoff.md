# Session 上下文交接（2026-07-14）

## 当前任务
创建 blueprint: `blueprint-permission-template-driven-enforcement.md`
将 per-agent 身份型权限验证迁移为模板化行为型 enforcement。

## 已完成的任务
- **P0 #1** ✅: 删除 agent-identity.ts 的 plan:"Meta-Planner" 映射。bun 实测 5 active agent 全部走 opencode.json。safe-bash-core + permission-equivalence 测试全 PASS。
- **P0 #2** ✅: tool-governance blueprint Phase 8/9 代码审核确认已修复（原标 🔴 未实施，更正为 ✅）。验证 codegraph 9/9 + write-bypass 5/5 + 治理域 41/41。勾选 §5.1(5)+§5.2(4)+§7(12) 共 21 个 checkbox。
- **P1 #4** ✅: dead 代码清理——4 个符号(isWriteAllowed/isPathAllowedForAgent/executeWriteAuditCheck/PermissionIsolation)已在代码库中删除，无需再做。

## 正在进行的任务：P1 #3 + blueprint 创建

### 背景
P1 #3: getAgentShellAllowlist 3 个 active caller 迁移到行为型。

### 已完成的分析与验证
1. **3 个 active caller 确认**: permission-policy.ts:10(before handler)、shell-guard.ts:170(执行层)、shell-config.ts:364(执行层)
2. **safeBashTool 7 个检查点分析**:
   - ①getAllowlist(agent) [身份型] ②_hasAgentDangerousBypass [身份型]
   - ③getAgentShellAllowlist deny/ask [身份型] ← 要删
   - ④buildVerifiedCommandPlan [行为型] 保留
   - ⑤isDangerous [行为型] 保留
   - ⑥isAllowed(agent allowlist) [身份型] ← 要删
   - ⑦script content scan [行为型] 保留
3. **live serve 验证**: session ses_0a1c52ebdffe98AUmnRzAdsMEh 确认 before handler(governance_allow)先于 safeBashTool 执行。OpenCode runtime 保证 tool.execute.before hook 先于 tool execute。
4. **buildVerifiedCommandPlan 分析**: resolveExecutable 做 executable 级白名单(行为型)，但不覆盖参数级白名单。shell-plan.ts:131-211。
5. **选项分析**: A(只删③无实质价值) B(删③⑥从白名单变黑名单,安全方向性变化大) C(删③保留⑥但allowlist改全局default) → 用户提出模板化方案

### 用户提出的设计方向：权限模板化
- 模板: default/confirm/trusted，per-agent 绑定（不是全局模式）
- 安全底线固定不可调: dangerous shell/protected path/CodeGraph/repo write hard_block
- 模板可调项: shell_allowlist 宽窄(default/extended/ALL_ALLOWED)、unknown_command 处置(deny/ask/allow)、repo_read 处置
- 配置在 project.config.json(permission_templates) + opencode.json(agent.permission_template)
- permission-policy 改为读模板，不再调 getAgentShellAllowlist
- shell-guard 删 ③⑥，保留 ⑤④⑦
- getAgentShellAllowlist 彻底退役(3 caller→0)
- legacy-agent-permissions.ts(905行)同步退役(P1 #5)

### blueprint 状态
- 已调用 blueprint-creation skill，获取了 6 阶段流程模板
- **blueprint 文件尚未写入**（Write 工具遇到技术问题）
- 下一步: 将完整 blueprint 写入 `blueprints/blueprint-permission-template-driven-enforcement.md`

## 关键文件路径
- 工作目录: /home/zhaoge/workspace/qoderwork/
- work-one: /home/zhaoge/workspace/opencode/work-one/
- blueprint 目标: /home/zhaoge/workspace/qoderwork/blueprints/blueprint-permission-template-driven-enforcement.md
- 进度日志: /home/zhaoge/workspace/qoderwork/logs/2026-07-13-priority-todo-execution.md
- 已有 blueprint: blueprint-opencode-framework-simplification-roadmap.md, blueprint-tool-governance-mvc-refactor.md

## 关键代码位置（work-one）
- permission-policy.ts: .opencode/service/tool-governance/policies/permission-policy.ts (43行, evaluate 函数调 getAgentShellAllowlist)
- shell-guard.ts: .opencode/service/file-guard/shell-guard.ts (safeBashTool 在 line 154)
- shell-config.ts: .opencode/service/file-guard/shell-config.ts (getAllowlist 在 line 358)
- reader.ts: .opencode/service/permission/reader.ts (getAgentPermission:119, getAgentShellAllowlist:180, 已 @deprecated)
- legacy-agent-permissions.ts: .opencode/service/permission/legacy-agent-permissions.ts (905行, LEGACY_AGENT_PERMISSIONS)
- shell-plan.ts: .opencode/service/file-guard/shell-plan.ts (buildVerifiedCommandPlan:131, resolveExecutable 做 executable 白名单)
- context.ts: .opencode/service/tool-governance/context.ts (ToolGovernanceContext 定义)
- project.config.json: .opencode/project.config.json (plugin_execution_order, default_allowlist 等)
- opencode.json: opencode.json (agent permission 配置)

## blueprint §2.6 约束（必须遵守）
"不再保留 advisory/strict/locked 全局模式；每条规则固定为 hard block/warn continue/audit only/ask QoderWork。是否阻断由规则类型决定，不由当前模式决定。"
→ 模板不能改变安全底线规则的 disposition，只能调非底线项。

## Todo List 状态
- P0 #1 ✅ P0 #2 ✅ P1 #4 ✅
- P1 #3 进行中（创建 blueprint 中）
- P1 #5(legacy-agent-permissions退役) 依赖 P1 #3
- P1 #6-#9 待做

## 新 session 接续指引
1. 读 AGENTS.md
2. 读本文件
3. 读 logs/2026-07-13-priority-todo-execution.md
4. 继续: 用 blueprint-creation skill 的 6 阶段流程，将权限模板化设计写入 blueprint 文件
5. blueprint 分两 Phase: Phase 1(default+trusted 模板+P1#3迁移+getAgentShellAllowlist退役) Phase 2(扩展模板+迁移所有 agent 配置)
