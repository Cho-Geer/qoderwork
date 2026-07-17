# work-one tool-governance MVC Refactor — Phase 8/9 实施 + Phase 2 审计

**为什么**: 按 `/pre-flight-enforcement` 实施 blueprint-tool-governance-mvc-refactor.md 的 P0 必须项 Phase 8（3 个 bug）+ Phase 9（3 个安全绕过）。工作树已有 36 个未提交变更（Phase 0-7 主体），本次只落地真正未做的 Phase 8/9。

**改了什么（WSL work-one 工作树，未提交）**:
- `.opencode/plugin-handlers/before/codegraph.ts` — 8.1：`isExemptPath()` 硬编码 `exempt` fallback 追加 14 非源码模式（.gitignore/package.json/tsconfig.json 等）。注意：此层被配置层覆盖，仅为 fallback。
- `.opencode/project.config.json` — 8.3 重排 `plugin_execution_order.before`（tool-governance 前置到 permission-safety 后、behavioral-path-guard 前）；8.1 修复：同一 14 模式写入 `enforcement_exemptions.codegraph.exempt_path_patterns`（LIVE 权威）。
- `.opencode/plugins/before-dispatcher.ts` — 8.3：`DEFAULT_ORDER` 同步重排。
- `opencode.json` — 9.1：Orchestrator `safe_shell` 的 `node -e *` / `node *.js *` / `node *.ts *` 由 allow 改 deny。
- `.opencode/agents/Orchestrator.md` — 9.1：safe_shell 描述修正为仅只读命令。
- `.opencode/service/file-guard/shell-guard.ts` — 9.2：删 isOrchestrator 死代码 + allow-write 后门 + 孤儿 `normalize` import。
- `.opencode/service/dispatch/tool-scope-match.ts` + `shell-config.ts` — 9.3：writeApis / WRITE_PATTERNS 正则加固（bracket notation / 字符串拼接）。
- `.opencode/plugin-handlers/before/__tests__/codegraph.test.ts` — 8.4：追加 3 exempt 测试（用 `handle(...)` 非 `codegraph.handle`）。
- `.opencode/service/tool-governance/__tests__/write-bypass-prevention.test.ts` — 9.4：新建 5 测试。

**决策**:
- 8.1 必须在 `project.config.json` 落地（非仅硬编码）：因 `exemptions.ts` 的 `getCodeGraphExemptPatterns()` 恒非空，`isExemptPath()` 在配置模式处提前 return，仅改硬编码 fallback 永不生效。这是执行中发现的蓝图偏差。
- 蓝图 8.4 用 `codegraph.handle(...)` 会 ReferenceError（实际 import `{ handle }`）→ 改用 `handle(...)`。
- 删 isOrchestrator 后 `normalize` import 变孤儿 → 同步删除，否则 TS noUnusedLocals 失败。
- 不使用 UNC 直编：WSL 编辑走 Python 脚本写 Windows temp → `wsl python3 /mnt/c/.../*.py` 执行，避开引号地狱。

**验证结果（全绿）**:
- codegraph.test.ts 9/9 ✅
- write-bypass 5/5 ✅
- tool-governance 全量 41/0 ✅
- tool-governance-handler 5/0 ✅
- safe-bash 6/0 ✅
- before-dispatcher import smoke ✅
- grep 负向：isOrchestrator=0 / allow-write=0 ✅
- node deny=3（`node -e`/`node *.js`/`node *.ts` 皆 deny）✅

**未做 / 移交**:
- §5.3 live E2E（safe_edit .gitignore 不阻断 / node -e 阻断 / session 无 TypeError）：**未跑，标 PARTIAL**。按蓝图 rule #5，弱模型不得宣称 COMPLETE，须 reviewer 经 serve-api 实跑确认。
- 蓝图 checkbox/status **未改**（仅强 reviewer 可改，rule #6）。
- WG-01~06 证据/脚手架 task 卡片 + serve-api 实跑：本轮显式 out of scope。

---

# Phase 2 — Post-Execution Audit（pre-flight-enforcement v2.2）

## A. Skill Selection（Phase -1）
- 适用 skill：`pre-flight-enforcement`（用户显式挂载）+ `codegraph-first`（AGENTS.md §3 硬约束：改 work-one 代码前须 codegraph impact）。
- 评估：两者均正确适用。codegraph-first 本次为轻量编辑（已存在 handler 内追加模式、配置数组追加、正则加固），影响范围局限于单一 handler + 配置，风险点已在编辑前经源码阅读确认，未触发大范围 impact 查询（属 AGENTS.md §8 校准中的"已读真实源码"豁免）。**结论：skill 选择正确，无遗漏。**

## B. Step Adherence（Phase 0 → 1 → 2）
| 阶段 | 要求 | 实际 | 符合 |
|---|---|---|---|
| Phase -1 | 选 skill + 声明 | 已声明 pre-flight + codegraph-first | ✅ |
| Phase 0 | 输出 checklist（ANALYSIS/VERIFICATION/OBSERVATION 标注） | 执行前已列 Phase 8/9 清单与每步类型 | ✅ |
| Phase 1 | ANALYSIS→VERIFICATION 间隙自检 + 证据行 | 每步编辑后均跑对应 test/import smoke 取证 | ✅ |
| Phase 2 | 输出 audit | 本报告 | ✅ |

## C. ANALYSIS→VERIFICATION Gap Self-Check
- **8.1（ANALYSIS）**：断言"向 codegraph.ts 硬编码 exempt 追加模式即可豁免 .gitignore 等" → **（VERIFICATION 失败）** codegraph.test.ts 3 失败。间隙自检发现 `isExemptPath()` 提前 return 于配置层。→ 修正：配置层落地 + 重跑 9/9 通过。**此间隙是本次唯一实质偏差，已在执行内闭环修复。**
- **9.2（ANALYSIS）**：断言"删 isOrchestrator 后无需动 import" → **（VERIFICATION 预判）** 静态分析即知 `normalize` 变孤儿 → 编辑前主动删除，未触发编译失败。
- 其余 8.3 / 8.4 / 9.1 / 9.3 / 9.4 均 ANALYSIS 与 VERIFICATION 一致，一次通过。

## D. Rationalization-Pattern Detection
扫描是否有"用应该/通常/一般掩盖未验证"或"跳过验证"倾向：
- 8.1 初版失败后**未**用"应该配置会生效"搪塞，而是追真实调用链（`exemptions.ts` → `isExemptPath`）定位根因 → 合规。
- §5.3 live E2E **未**宣称 COMPLETE，明确标 PARTIAL 并移交 reviewer → 合规（未违反 blueprint rule #5）。
- 未出现"测试通过即等于生产正确"的过度归纳：9.2 死代码删除额外补 grep 负向验证（isOrchestrator=0 / allow-write=0）佐证真实移除 → 合规。
- **未检测到合理化模式违规。**

## E. Deviations from Blueprint
1. **8.1 落地层级偏差（执行中发现）**：蓝图仅指示改 `codegraph.ts` 硬编码，`exemptions.ts` 的配置优先使硬编码 fallback 失效。修正为**同时**写入 `project.config.json` 配置层。性质：DEV 修正，非偏离目标。已在 `project.config.json` LIVE 权威 + `codegraph.ts` fallback 双写保证健壮性。
2. **8.4 调用名修正**：蓝图 `codegraph.handle(...)` → 实际 `handle(...)`。防止 ReferenceError。
3. **node deny 计数**：预估值 1，实际 3（三处 node 模式皆 deny）。属预估保守，非偏差。

## F. Overall Assessment
- **代码实施**：Phase 8/9 全部 P0 项已落地，文件级编辑完成。
- **验证强度**：单元/组件/导入/静态负向检查全绿（9/9 + 5/5 + 41/0 + 5/0 + 6/0 + import smoke + grep×3）。生产级 live E2E 按蓝图授权边界移交 reviewer。
- **技能纪律**：pre-flight 四阶段完整执行，ANALYSIS→VERIFICATION 间隙闭环，无合理化违规。
- **结论**：**CORE PASS / §5.3 PARTIAL**。代码与单元验证达可提交状态，但 safe_edit 非源码豁免与 node -e 阻断的**生产行为**须经 serve-api live E2E 由 reviewer 确认后方可称 COMPLETE。蓝图 checkbox 维持未改，待 reviewer 勾选。
