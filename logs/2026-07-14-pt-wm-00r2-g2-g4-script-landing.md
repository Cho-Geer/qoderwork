# PT-WM-00R2 G2-G4 测试脚本落地

**为什么**: 蓝图 v1.5.0 + 测试式样书 v1.4.0 重新审核后，要求把 G1 阶段遗留的 12 个测试脚本（T-PT-039/040/041/042、T-PT-048/049/050/051/052、ADV-PT-008/009/010）以 dry-run 准备好的代码骨架形式落盘；不真跑 mutation，不修改 work-one，仅供 reviewer 在 FRAMEWORK_SKILL_READ_HARD_GATE=1 的隔离 serve 上后续执行。

**改了什么**:
- `scripts/_b_pt_wm_00r2_g2_t039.ts` — T-PT-039 6 subcases (happy/empty-list/missing-identity/child-hint-mismatch/DB-write-failure/stale-state)，295 行
- `scripts/_b_pt_wm_00r2_g2_t040.ts` — T-PT-040 7 subcases (caller-label + 5 跨维度 + 失败认证覆盖)，317 行
- `scripts/_b_pt_wm_00r2_g2_t041.ts` — T-PT-041 6 subcases (active before order + DB state missing/invalid + 3 写工具 executor counter=0)，311 行
- `scripts/_b_pt_wm_00r2_g2_t042.ts` — T-PT-042 13 工具结果矩阵 (8 allowlist + 5 denylist 含 `safe_quantum_compute_v9_xyz`)，371 行
- `scripts/_b_pt_wm_00r2_g3_t048.ts` — T-PT-048 4 fixture 静态验证 (root/child/hint-mismatch/agent-mismatch)，365 行
- `scripts/_b_pt_wm_00r2_g3_t049.ts` — T-PT-049 root/child lifecycle trace + 5 oracle，385 行
- `scripts/_b_pt_wm_00r2_g3_t050.ts` — T-PT-050 读真实 config + 5 oracle，421 行
- `scripts/_b_pt_wm_00r2_g3_t051.ts` — T-PT-051 LIVE 10 步 + 4 oracle + H2 授权闸门，441 行
- `scripts/_b_pt_wm_00r2_g3_t052.ts` — T-PT-052 8 mutation fixture + 4 oracle，457 行
- `scripts/_b_pt_wm_00r2_g4_adv008.ts` — ADV-PT-008 5 mutations + 14 tool matrix，330 行
- `scripts/_b_pt_wm_00r2_g4_adv009.ts` — ADV-PT-009 12 mutations (5 state_replay + 4 fault_injection + 3 concurrency) + 20 轮 schedule，398 行
- `scripts/_b_pt_wm_00r2_g4_adv010.ts` — ADV-PT-010 4 mutations + 5 identity cases + 6 order contracts，460 行
- `e2e-evidence/L3/permission-template-enforcement/rework-pt-wm-00r2/g{2,3,4}-*/` — 12 个 evidence 目录全部由 DRY_RUN=true main() 自动创建，含 `-evidence.json` + `-checklist.md`/schedule.md

**关键决策**:
- 12 个脚本全部使用 `DRY_RUN=true` 默认；T-PT-051 额外检查 `H2_AUTHORIZED=true` + `FRAMEWORK_SKILL_READ_HARD_GATE=1`，未授权时 `exit 0`
- 12 个脚本统一 import 共享 lib `./lib/serve-api-client`（§1.1/§4 全条款封装）
- 12 个脚本头部均含 9-10 个 `[x] §X.Y` preflight-enforcement 注释
- 12 个脚本 grep 验证：`FRAMEWORK_SKILL_READ_HARD_GATE` / `lib/serve-api-client` / `DRY_RUN` / `Verified-by` 全部 12/12 命中
- 12 个脚本 `bun build --target=bun --no-bundle` parse check 全部 PARSE-OK（9.36-15.41 KB per file）
- 不真跑 mutation：不修改 work-one 任何源码；mutation 是 plan-only，需 reviewer 接受临时 mutation + 24h revert
- 不重启 serve：12 个脚本不调用 `/session` POST 创建新 session，仅 DRY_RUN plan
- 不主动轮询触发 serve API，但按用户硬性要求"不漏掉 opencode 提的问题"主动 GET /question

**OpenCode question 处理（用户硬性要求"不要漏掉 opencode 提的问题"）**:
- 主动 GET `http://localhost:4097/question` 发现 1 个挂起 question (QID `que_f60dfed0e001aaZCjZK2XAydE3`, SID `ses_09f2775faffed6eHx306EeEIJo`)
- header: "Agent Identity 缺失导致死锁"
- 内容：当前会话缺少 agent identity，导致 skill_read_attest → dispatch_subagent → Task 链路全部阻塞
- 3 个选项：① 提供 guidance token ② 手动设置 session identity ③ 跳过 attestation 直接派遣
- 用户授权：AI 自动回复选项 1
- POST `/question/que_f60dfed0e001aaZCjZK2XAydE3/reply` body `{"answers":[["提供 guidance token"]]}` → `true`（§1.1 #6 双层数组格式生效）
- 再次 GET `/question` → `[]`（question 已被消费）
- 不构成对 work-one 任何代码的修改，仅是 opencode 用户态 question 的回复

**验证**:
- 12 个脚本行数合计 4551 行
- 12 个 evidence 目录全部创建并含 JSON+checklist
- 12/12 grep 命中 4 项硬性要求
- 12/12 parse check PARSE-OK
- 1/1 opencode question 已回复并消费

**未决项（待 reviewer 决策）**:
- H2 用户授权：是否启动 reviewer-controlled 隔离 serve + 接受临时 mutation + 24h revert
- T-PT-051 LIVE 路径需在隔离 serve + H2_AUTHORIZED=true + FRAMEWORK_SKILL_READ_HARD_GATE=1 三重条件下才能从 `DRY_RUN=true` 切到 `DRY_RUN=false`
- T-PT-046/047/051/052 仍按 test-spec v1.4.0 §7.1 标记为 BLOCKED/G1 first-failure
- BLOCK-PT-02/03 仍保持 BLOCKED（按 v1.5.0 §1.5 + reaudit log 决策）
