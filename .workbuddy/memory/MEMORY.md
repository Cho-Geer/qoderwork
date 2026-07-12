# QoderWork Project Memory

## work-one 架构权威数量（2026-07-10 源码验证）
- Agent 5（Orchestrator 自定义 + 4 native）· Plugin 5 · Handler 39（before20+after19）· 自定义 Tool 37 · Lib 51 · MCP 12 · DB 50 表 · schema v37。设计蓝图 10 角色仅 Orchestrator 有 .md。

## work-one 计数器关键事实
- `consecutive_failures` 仅 `detectFailure()=failed`/`recordBlock()` 递增；软拒绝独立 `soft_rejections` 表，不递增、需 `resetSoftRejections()` 单独重置。`clearGuidance()` 只清 consecutive_failures+compliance_blocks。重置路径：clearGuidance/clearAwaitingGuidance/TTL。

## work-one Question 混合 Enforcement（2026-07-04）
- `checkThreshold()` 已接 anti-bypass handle；Phase1/STOP 的 acp_notify 改 `question` 工具；before 白名单+after `rewardReport()→clearGuidance()`。`getGuidanceStatus()` 在 awaiting=0 返回空，after-hook 须用 `getFailureSummary().consecutiveFailures>0`。deliver-guidance.sh 直写 DB。acp_notify 保留兼容。

## work-one E2E 测试关键经验
- 改 .ts 须重启 serve + 清 `~/.cache/bun`。WSL 无 sqlite3 CLI，用 bun:sqlite。消息端点 `POST /session/{id}/message`。before-hook 仅阻断非 read-only。脚本 `qoderwork/scripts/e2e-*.ts`。

## WorkBuddy 技能加载路径（2026-07-12 实测）
- **唯一可靠注册路径 = 用户级 Windows `C:\Users\USER\.workbuddy\skills\`**（经进程级重启生效）。WSL 项目级/用户级 `.workbuddy/skills/` + `.agents/skills/` **均不扫描**。19 个项目技能已 move 至用户级（现 33 目录）。

## work-one 诊断事实
- dispatch_subagent.ts:72-75 先写 _dispatch 再建 grant（EROFS 单点）；router.ts:299-332 依赖 stdout 第0行。dispatch-marker-consume=hard_block（Task 缺 token 被硬阻断是上游症状）。`[FW-ENFORCE][REPO-OP]`=codegraph.ts:149/175；`BREAK-GLASS-PATH-GUARD`=behavioral-path-guard，别混。tool-tracker.ts 4 处 INSERT arity 风险→STOP/question 不可靠。
- **WSL interop**：Bash 经 `wsl -d Ubuntu-24.04 -- <cmd>`；复杂引号用脚本文件避 safe-bin shim。`bun`=`/home/zhaoge/.bun/bin/bun`（不在 PATH）。opencode serve=127.0.0.1:4096。DB 取证走 WSL。

## work-one skill-summary 配置
- skill-summary.ts `AGENT_SKILLS` 仅 Orchestrator（8 skill）；9 blueprint agent 条目是死配置。`framework-maintenance` 的 safe_framework_edit+grant 是 agent-runtime 控制，WorkBuddy 侧直编 .ts 不触发。

## work-one 废弃内容审计（2026-07-11 起，2026-07-12 收尾）
- 废弃目录 15 个已确认（`.opencode/.trash-*/`、`.task_temp`、`.opencode/.opencode`、`src/_e2e_test_fixture` 等）。`legacy/` 混合（agent-profiles 仍活跃引用）。勿删：blueprints/.opencode/docs/plans/scripts/.qoder。
- **2026-07-12 收尾（F1/F2/F3 已解决）**：`@Meta-Planner` 用户可见指引全改为 `@plan`（dispatch_subagent/dispatch-validate/gate-validate/route-validator-l0-l2/prompt-sections/checklist-phase/framework-doctor/dag-version-manager）；`isolation.ts` 的 `@Meta-Planner` PERMISSION_PROFILES 死条目已删除（DEPRECATED 孤儿文件，0 运行时调用方）；hook-commit-msg.ts 移除实时 getEnforcementModeWithSource 调用；gate-core 4 文件加 RETENTION NOTE（mode-compat 导出仅保留给 PROTECTED 文件 hook-layers.ts / pre-execution-gate.ts）。残余仅 3 个 *.test.ts（允许）。

## work-one pre-commit Layer 1.8（2026-07-12 修正）
- 真实根因：gate-lifecycle-audit.ts 在 stale session 时**非 0 退出**→execSync 抛异常→catch 误判 BLOCKED（非 30s 超时）。修复 b4a62fb9：catch 解析 JSON，仅无 JSON 才硬阻断。`state-reconciliation.ts --fix` 无效（module is not defined）。git commit 须 `bun` 在 PATH；hook 输出重定向 `.task_temp/_logs/hook-layers.log`。INFRA 提交带 `[INFRA]`。work-one 是 git 仓；qoderwork 不是。

## work-one serve loads working tree not HEAD（2026-07-12）
- `opencode serve` 读 working-tree .ts，非 HEAD。审计提交后若工作树保留 feature 版，运行态不反映审计；运行时验证需 `git checkout HEAD -- <f>` + 重启 serve（扰动未提交 feature，慎）。pre-commit 不跑 framework-self-test/doctor。

## pre-flight-enforcement skill
- 位于 `.agents/skills/`；WorkBuddy 不自动发现，须手工遵循其 pre-flight+audit 纪律或用户显式挂载。
