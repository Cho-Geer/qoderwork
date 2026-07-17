# L3-012 repo-op-deny 重写为 serve-api skill 全条款遵循版本

**为什么**: 用户质问"为什么不按 serve-api 技能要求执行"——审计发现 `_b_l3_012_repo_op_deny.ts` v1 只用了 §1.1 核心操作 1-4 (session/message/SSE)，漏掉 5-10 (question/identity/turn)，导致 6 个 pending question 无人回复。

**改了什么**:
- `scripts/_b_l3_012_repo_op_deny.ts` — 完整重写 (v1 159 行 → v2 300 行)
  - 新增 `getSessionAgent()` (line 71-77)：§4.6 先查再发 identity-preserve pattern
  - 新增 `promptAsync(sid, text)` (line 80-88)：§4.4 必传 agent 字段
  - 新增 `pollAndReplyQuestions(knownSids)` (line 91-121)：§1.1 #5/#6 主动 GET /question + 自动 reply
  - 新增 `waitForIdle(sid, timeoutMs)` (line 124-160)：§4.5 Turn 模型，按 session.idle/error 判定
  - 删除硬等 30s 逻辑（旧 line 74）
  - 删除裸 prompt_async（旧 line 68-70）
  - 删除简单 GET children（旧 line 109）
  - 每步加 `Verified-by: <端点> → <关键返回>` 证据行
  - 文件头注释列出 `[x] §X.Y` 7 条遵循清单

- `project_memory.md` — 新增"serve-api skill 全条款遵循清单"+"每次写 live E2E 脚本前的强制流程"+"违规实证"3 段

**决策**:
- 选择 v2 完整重写（不是 patch 旧版），原因是违反项太多（7 条），patch 会留尾巴
- 选择"先查再发 + 必传 agent"作为不可绕过的硬要求（v1 漏掉导致子 session 身份被覆盖为 Orchestrator）
- 选择模板自动 reply（不再让用户手动处理 question），原因是 6 个 pending question 暴露了"必须人肉处理"的反模式
- 选择不加 retry 机制（v1 没有，v2 也不加），原因是 live E2E 一次性信号，重跑会污染证据

**被否决的替代方案**:
- ❌ 只加 question 轮询不改其他 → 治标不治本，下次又会有其他 5-10 项漏掉
- ❌ 抽公共 helper 到 `scripts/lib/` → 单文件标杆更易审查，避免过早抽象

**下次写 live E2E 脚本前**:
1. 先 `Skill serve-api` 看 § 章节
2. 写完自检 `grep -E "Verified-by:|pollAndReplyQuestions|getSessionAgent|promptAsync\(" _b_xxx.ts` 必须全命中
3. 跑前向用户确认消耗 token
