# serve-api skill v1.3.0：Session 树监控与主动干预

**为什么**: 用户反馈当前 serve-api skill 在主 agent 派遣子 agent 后，QoderWork 只能分别监控单 session、也无法区分指导对象（父 vs 子）。`qoderwork/blueprints/blueprint-serve-api-session-tree-optimization.md` v1.1 给出了 4 个优化方向和 4 个脚本的实施计划。

**改了什么**:
- `qoderwork/scripts/session-tree.ts` (新) — 递归查询 session 树，支持人类可读输出和 `--json` 模式
- `qoderwork/scripts/monitor-tree.ts` (新) — 全树监控，5s 轮询，4 种 status 分类（idle/working/question-pending/error），连续 2 轮 idle 自动退出
- `qoderwork/scripts/guide.ts` (新) — 身份保留的轻量指导发送脚本
- `qoderwork/scripts/intervene.ts` (新) — 统一干预入口，4 种 mode（guide / reply-qid / abort / status）
- `qoderwork/.qoder/skills/serve-api/SKILL.md` v1.2.0 → v1.3.0 — 新增 §4 共 6 子节（session 树查询 / 全树监控 / 干预矩阵 / 身份保留 / Turn 模型 / 新增 Pitfalls）
- `qoderwork/.qoder/skills/serve-api/reference.md` — 新增 Section C 共 7 节（C.0 前置 + 6 个场景 + 汇总模板）

**决策**:
- `/children` endpoint 实测返回合法 JSON（HTTP 200 + application/json），无需走蓝图 v1.1 §三提到的 SDK DB / SSE / framework DB fallback
- 4 个脚本独立不共享 import，方便单独测试；argv 解析统一支持 `--key value` 和 `--key=value` 两种形式（修复了初版只支持前者的 bug）
- `session.time.updated` 作为 activity 信号，替代不存在的 per-session event REST 端点（实测 `GET /session/{sid}/event` 返回 HTML 404）
- monitor-tree 用 `GET /question` 做 question-pending 分类，不依赖 SSE daemon
- intervene.ts 统一入口，guide.ts 保留为轻量别名

**实测证据**:
- session-tree.ts：`ses_0c9798a78ffe4r46ZvYSXZyBWL` → 2 节点树 + JSON 输出均正确
- monitor-tree.ts：idle session 上跑，18s 后正确触发 "✓ all idle x2 rounds, tree completed" 退出 0
- guide.ts：发送成功，agent=Orchestrator (preserved)
- intervene.ts：status / guide / abort / reply-qid 4 mode 全部按预期工作；reply-qid 用错误 SID 时 exit=3

**已知副作用**:
- 子 session 通过直发消息（不传 agent 字段）后，agent 身份被覆盖为 `Orchestrator` —— 在 SKILL.md §4.4 和 §4.6 显式警告，intervene.ts 自动处理

**下一步**：
- 跑 reference.md Section C 的 6 个场景实测，填 C.7 汇总模板
- 考虑把 `GET /event` 全局 SSE 流接入 monitor-tree（`--sse` 选项）做精确事件驱动干预
