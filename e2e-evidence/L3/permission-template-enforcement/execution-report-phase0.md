# Phase 0 执行报告 — 权限模板驱动 Enforcement (PT-WM-00 部分)

**日期**: 2026-07-14
**执行入口**: pre-flight-enforcement (约束) + blueprint §3.2 / PT-WM-00 (执行规范)
**范围**: T-PT-001, T-PT-002(负向), T-PT-005 已执行；T-PT-003/004 待 live session attest
**注意**: 本报告的 PASS/BLOCKED 是执行器证据记录；测试式样书状态列与 blueprint checkbox 仅 reviewer 可更新。

## T-PT-001 — runtime Skill 同步与发现 (happy / runtime-smoke)
- REQ: REQ-PT-001 | 层级: runtime-smoke
- 操作: 从 `C:\Users\USER\.workbuddy\skills\` 复制两份 Skill 到 `work-one/.opencode/skills/`；逐文件 SHA-256；`opencode debug skill`
- 命令: `cp -r ... ; sha256sum ... ; /home/zhaoge/.opencode/bin/opencode debug skill`
- 环境 identity: opencode 1.17.18；work-one @ /home/zhaoge/workspace/opencode/work-one
- 独立 oracle (ORA-PT-01): 两个 name 均出现且 source/runtime 哈希逐文件相同
- 证据:
  - SHA: requirements-to-test-specification {SKILL.md 6c2eb6c2…, TEST-SPEC-TEMPLATE.md cb3f9151…}; test-specification-execution {EXECUTION-REPORT-TEMPLATE.md 7a2751c7…, SKILL.md d6fbddcc…}；source 与 runtime diff 为空 (R2TS_IDENTICAL / TSE_IDENTICAL)
  - discovery: skill-discovery.txt line 75 + 105 含两个 name
- 结果: **PASS**

## T-PT-002 — 负向 (篡改检测 / runtime-smoke)
- REQ: REQ-PT-001 | 层级: runtime-smoke
- 操作: 复制 runtime SKILL.md 到 /tmp，追加一行，重算 SHA 与 source 比较
- oracle (ORA-PT-01): 任一差异使 gate 拒绝
- 证据: source 6c2eb6c2… vs tampered efe478f3… → MISMATCH → REJECT
- 结果: **PASS**

## T-PT-003 — 读取认证 (happy / integration)
- 状态: **BLOCKED** — 需驱动 live session 读取四 Skill 并经框架 read_audit 记录后调用 `skill_read_attest(task_id)`；本回合未改 project.config.json (framework-path，phase0-enforce 会拦截活跃 session)，未驱动 session。属下一步受控任务。
- 机制已查清: attestSkillRead → read_audit SQLite (verifyRead) + template_resolution.required_skill_reads (当前仅 preflight-lite, codegraph-first)。

## T-PT-004 — 负向读取认证 (negative / integration)
- 状态: **BLOCKED** — 同上，需 live session；未执行。

## T-PT-005 — 测试式样书 coverage gate (contract / document)
- REQ: REQ-PT-003, REQ-PT-014 | 层级: contract
- 操作: 重读测试式样书 §2–§7，独立复核 coverage gate
- oracle (ORA-PT-10): 每个 REQ 有 T；每个 T 有 ORA；critical/high 有 ADV；无缺字段 card
- 证据: REQ-PT-001..014 全部有 T 映射；38 个 T 全部有 ORA-PT-xx；ADV-PT-001..007 覆盖全部 critical/high；状态仅 DESIGNED/OPEN/BLOCKED；OPEN-PT-01/02、BLOCK-PT-01 保留；mocked internal helper = 0
- 结果: **PASS** (gate 指标全部 100%)

## BLOCK-PT-01 状态
- 部署 + SHA 一致 + runtime 发现 三个条件已满足 → **BLOCK-PT-01 解除**（部署/发现轴）。
- 注意: REQ-PT-002 (skill_read_attest) 是进入写入 task card 的独立门，仍需 live session attest (T-PT-003/004) 通过。

## 下一步 (受控)
1. V3: 将 requirements-to-test-specification / test-specification-execution 加入 project.config.json required_skill_reads（与受控 session 一起做，避免 phase0-enforce 误拦活跃 session）。
2. 驱动受控 session 读取四 Skill → 调用 skill_read_attest(task_id) → 验证 verified:true (T-PT-003) 与负向 verified:false (T-PT-004)。
3. 仅当 BLOCK-PT-01 + REQ-PT-002 全通过，且 reviewer gate 放行，才进入 Phase 1 (PT-WM-01/02) 代码修改。
