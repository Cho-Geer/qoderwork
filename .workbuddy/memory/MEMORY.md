# QoderWork Project Memory

## PT-WM-00R2 权限模板 Enforcement 审核状态（2026-07-15 G5 复核）
- **G2–G4 不是测试完成**：仅 12 个 DRY_RUN 计划脚本落盘（scripts/_b_pt_wm_00r2_{g2,g3,g4}_*.ts，4551 行）+ 2 个 live 辅助脚本；12 个 evidence 目录均 dryRun:true。**任何 test ID 不得升级为 PASS**。
- **T-PT-042 runner INVALID**：`_b_pt_wm_00r2_g2_t042.ts` 错误列入 list/skill_read_state，遗漏 config_read_attest/rule_read_attest；权威固定 allowlist（skill-policy.ts）= read/glob/grep/question/skill/config_read_attest/skill_read_attest/rule_read_attest。测试需求仍 BLOCKED。
- **T-PT-048** 仅 4 个静态 fixture-shape 断言通过，真实 oracle 未执行 → NOT-RUN。
- **4097 端口**审核时不可连接 → 历史 question 当前状态 UNVERIFIED，不得写作"仍挂起"。
- 真跑前置：reviewer 启动隔离 serve + `FRAMEWORK_SKILL_READ_HARD_GATE=1`（T-PT-051 额外 DRY_RUN=false+H2_AUTHORIZED=true）；顺序见 test-spec §8。BLOCK-PT-02/03 未解除。
- 蓝图 v1.6.0 / 测试式样书 v1.5.0。不改 work-one 源码。

## WSL 路径陷阱（2026-07-15 实测）
- Bash 工具 cwd = `//wsl.localhost/Ubuntu-24.04/home/zhaoge/workspace/qoderwork`。`cd /home/zhaoge/workspace/qoderwork` 会落到 Git Bash 同名异目录（仅 .workbuddy/scripts/team-elevation），导致目录看似为空。文件操作须用 `//wsl.localhost/...` 全路径或保持默认 cwd。Read/Write 工具用 `/home/zhaoge/...` 真实 WSL 路径可正确解析。
