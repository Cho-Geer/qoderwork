# PT-WM-00R2 Reviewer 级证据复跑报告

**为什么**: Reviewer (QoderWork 强模型) 按 Blueprint v1.3.0 + 测试式样书 v1.2.0 + 今日 Reviewer 审计 log，重新执行 `PT-WM-00R2` 修复的 source/component 层面证据复跑，验证 BLOCK-PT-02/03 根因是否在源码层和 component test 层修复。Live E2E 与 active-dispatcher 集成测试需要隔离 serve + 独立 DB + 多 session，仍按 test spec §8 顺序由后续 review session 补做。

**改了什么**:
- 复跑 `bun test` 11 个 component tests (6 skill-attest + 5 skill-policy)
- 复跑 41 个 tool-governance baseline tests（无回归）
- 用 Grep 验证 writer/validator 共用 `resolveSkillAttestationIdentity`
- 用 Read 验证 `project.config.json` active before order 中 `skill-policy` 在 `tool-governance` 前
- 用 Read 验证 `before-dispatcher.ts` 的 `DEFAULT_ORDER` 中 `skill-policy` 也在 `tool-governance` 前
- 用 Read 验证 `rule-disposition.ts:74` `skill-read-attest-required: hard_block`
- 用 Glob 检查 `.opencode/plugins/__tests__/skill-hard-gate-integration.test.ts` — **未找到**

**决策**:
- **源根因修复（BLOCK-PT-03 三个缺陷）**:
  - shared identity resolver ✓ (skill-attest.ts:106 定义, 170/361 同时调用)
  - `requested_task_id` 仅审计不授权 ✓ (resolveSkillAttestationIdentity 不依赖 caller 传值)
  - active config order `skill-policy < tool-governance` ✓ (project.config.json:1914-1915)
  - source `DEFAULT_ORDER` 一致 ✓ (before-dispatcher.ts:68-69)
- **component test 修复（BLOCK-PT-02 hard-block 行为）**:
  - T-PT-039/040/041/042/046 + ADV-PT-008 全部 11/11 PASS
  - write tools (safe_edit/safe_shell/safe_framework_edit/dispatch_subagent) 均被 `skill-read-attest-required` 阻断
  - pre-attest allowlist 8 工具正确放行
  - 未知/未来工具默认拒绝 (fail-closed)
  - 异常成功传出 handler (未在 handler 内 catch)
- **未完成项（按 test spec §8 顺序）**:
  - `.opencode/plugins/__tests__/skill-hard-gate-integration.test.ts` **不存在**（Blueprint §3.1 显式要求 00R2 新建）
  - T-PT-002 tamper 负向用例未执行
  - T-PT-046/047/051/052 live LLM E2E 未执行（需要 reviewer 重启 serve + 独立 DB + 新 session）
  - T-PT-048/049/050 完整 lifecycle 复跑未执行
  - 20 轮并发/故障注入未执行
  - mutation run 未执行

**Final Gate 判定**:
- **BLOCK-PT-03 (source-level 修复)**: source 层已修复，11/11 component tests 验证
- **BLOCK-PT-02 (component-level 修复)**: component 层已修复，11/11 component tests 验证
- **两 BLOCK 共同解除**: 仍 **REWORK**。理由: active-dispatcher 集成测试缺失 (T-PT-004 关键 case 仍未被 active dispatcher 执行)；live E2E (T-PT-046/047/051/052) 未跑；旧 00R evidence 在 rework-pt-wm-00r/ 仍可读但未与 00R2 区分 commit。后续 review session 必须按 test spec §8 step 1-7 完整执行。

**后续最小必做清单（review session）**:
1. 创建 `e2e-evidence/L3/permission-template-enforcement/rework-pt-wm-00r2/` 目录
2. 创建隔离 worktree + 独立 `FRAMEWORK_DB_PATH`
3. Reviewer 重启隔离 serve `FRAMEWORK_SKILL_READ_HARD_GATE=1`
4. 新建 `.opencode/plugins/__tests__/skill-hard-gate-integration.test.ts`（按 Blueprint §3.1 描述）
5. 执行 T-PT-048/049/050 → T-PT-002/004/039-045 + ADV-PT-008-010
6. 清 Bun cache + 重启 serve + 执行 T-PT-046/051/052 + 重跑 T-PT-047
7. 复跑关键 tool-governance baseline（确认无回归）
8. 写 `e2e-evidence/L3/permission-template-enforcement/rework-pt-wm-00r2/execution-report-reviewer-live-e2e.md`
9. 复跑本日志中列出的 source/component 证据作为对账

**Verified-by 引用**:
- `bun test ./.opencode/service/session/__tests__/skill-attest.test.ts` → 6 pass / 0 fail
- `bun test ./.opencode/plugin-handlers/before/__tests__/skill-policy.test.ts` → 5 pass / 0 fail
- `bun test ./.opencode/service/tool-governance/__tests__/` → 41 pass / 0 fail
- `Grep resolveSkillAttestationIdentity` → 3 命中点 (定义 + writer + validator)
- `Read .opencode/project.config.json:1908-1921` → `skill-policy` 在 `tool-governance` 前
- `Read .opencode/service/enforcement/rule-disposition.ts:74` → `skill-read-attest-required: hard_block`
