# PT-WM-00R2 Reviewer Live E2E 续 — 集成测试建立

**为什么**: 前轮 source + component 复跑后 Final Gate 判定 Rework, 列出"后续最小必做清单"第 1 项 "新建 `.opencode/plugins/__tests__/skill-hard-gate-integration.test.ts`（按 Blueprint §3.1 描述）" 是 00R 失败的核心缺口 (T-PT-004 active-dispatcher `safe_edit` 路径未被 active dispatcher 实际执行)。本轮建立该集成测试并跑通, 补 BLOCK-PT-02 active-dispatcher 行为证据 + BLOCK-PT-03 active order 错误来源证据。

**改了什么**:
- `work-one/.opencode/plugins/__tests__/skill-hard-gate-integration.test.ts` (NEW, 208 lines) — 6 个 active-dispatcher 集成测试, 覆盖 T-PT-004 (a/b/c/d) + T-PT-002 + T-PT-050
- `qoderwork/e2e-evidence/L3/permission-template-enforcement/rework-pt-wm-00r2/integration-evidence.md` (NEW) — 00R2 独立 evidence 目录, 与 00R 旧 evidence 物理隔离
- `work-one/.opencode/plugins/__tests__/` 目录从无到有 (Blueprint §3.1 要求的 active-dispatcher 集成测试存放点)

**实现要点**:
- 参考 `qoderwork/scripts/_b1_live.ts` 的 live test 模式 (驱动真实 production handler + 隔离 env)
- 隔离: 每次 test 用 `fs.mkdtempSync()` 建独立 temp worktree (skills + 最小 project.config.json + 独立 DB)
- 真实链路: `import("../before-dispatcher")` 拉真实 dispatcher, `await exported({})` 拿真实 hooks, 然后 `hooks["tool.execute.before"](input, output)` 走完整 11-handler 链
- Env 隔离: per-test 设置 `OPENCODE_ROOT=tempDir`, `FRAMEWORK_DB_PATH=tempDir/test.db`, `FRAMEWORK_SKILL_READ_HARD_GATE=1`, 退出时还原原值
- Active order 证明: T-PT-050 通过 assert 错误消息以 `[skill-read-attest-required]` 开头 (skill-policy 特征) 而非 tool-governance 特征, 反向证明 skill-policy 在 tool-governance 之前执行

**决策**:
- **新建 1 个测试文件而非 5 个**: 集成测试共享同一 dispatcher setup, 拆 5 个文件会增加 setup 重复和环境漂移风险
- **T-PT-046/047/051/052 live LLM E2E 仍未跑**: 需要 reviewer 重启 serve + 新 session, 单个 review session 范围外
- **00R vs 00R2 物理隔离**: 00R 旧 evidence 在 `rework-pt-wm-00r/` (4 文件, 2026-07-14 13:32-18:17) 未触碰; 00R2 新 evidence 在新建的 `rework-pt-wm-00r2/` 目录
- **Final Gate**: 仍 **Rework**。本轮已补最关键的 active-dispatcher 集成证据, BLOCK-PT-02/03 共同解除仍需后续 review session 完成 live LLM E2E + 并发 + 故障注入 + mutation run

**测试结果**:
- 单文件 6/6 PASS (134ms, 13 expect() calls)
- 综合回归 58/0 PASS (238ms, 139 expect() calls, 13 files)
- 旧 baseline (tool-governance 41 tests) 无回归

**Verified-by**:
- `bun test ./.opencode/plugins/__tests__/skill-hard-gate-integration.test.ts` → 6 pass / 0 fail
- 综合 4 文件 bun test → 58 pass / 0 fail / 139 expect() / 238ms
- `git status` → 仅 1 个新 untracked 文件, 无源码修改
- `ls -la e2e-evidence/.../rework-pt-wm-00r/` → 4 旧文件未变 (00R 隔离证明)
- `mkdir -p rework-pt-wm-00r2/` → 新目录独立 (00R2 隔离证明)
