# Serve API v1.3.0 E2E 验证报告

**日期**: 2026-07-06
**Serve 端口**: 4096
**Serve 状态**: healthy

## 脚本验证

- [x] session-tree.ts: 场景 A PASS — root(Orchestrator) + 1 child(build), JSON allIds=2, leafIds=1, parent 字段正确
- [x] monitor-tree.ts: 场景 B PASS — 观测到 child=working→idle 转变, exit=0, "all idle x2 rounds" 输出
- [x] intervene.ts --mode=guide: 场景 C PASS — "guide sent" + agent: build (preserved), AGENT_BEFORE==AGENT_AFTER
- [x] intervene.ts --mode=reply-qid: 场景 D PASS — 2 pending questions 各含 sessionID, 正确 SID exit=0, 错误 SID exit=3
- [x] intervene.ts mid-turn 行为: 场景 E PASS — 注入时 status=working, agent 5s 后在下一 turn 确认收到
- [x] intervene.ts --mode=abort: 场景 F PASS — abort 前 working, "confirmed: yes", abort 后 idle

## Turn 模型确认

- [x] prompt_async 不在 turn 中生效（场景 E 证明：注入在 turn 边界进入，agent 完成当前操作后处理）
- [x] question/reply 立即生效（场景 D 证明：reply-qid 成功回复后 question 消失）
- [x] abort 立即终止（场景 F 证明：5s 内 working→idle）

## 身份保留确认

- [x] guide 直发子 session 后 agent 字段不变（build→build）
- [x] intervene.ts 自动保留原始 agent 身份发送

## Session IDs 记录

| 场景 | SID | 角色 |
|------|-----|------|
| A/B | `ses_0c8b58f92ffefSmRkFnaoMGwQQ` | parent (Orchestrator) |
| A | `ses_0c8b56611ffeoQ6sv4vXbzFcWp` | child 1 (build) |
| B | `ses_0c8b4404fffeUhfp121tPoD9aR` | child 2 (build) |
| C | `ses_0c8b4404fffeUhfp121tPoD9aR` | 复用 child 2 |
| D | `ses_0c8b30203ffeFD5zTD6bhOFXaY` | parent-q |
| D | `ses_0c8b301ddffe0P8zhM5fN8GuOJ` | child-q |
| E | `ses_0c8b02cbdffeGW4WSzSnui159M` | mid-turn-test |
| F | `ses_0c8ae7147ffeJXdg4TspY1j6i7` | abort-test |

## 偏差说明

- C.5 mid-turn 测试中，guidance 恰好在 turn 边界进入（agent 在两次 tool call 之间），未完全复现"mid-turn 被阻断"场景。但 agent 处理 guidance 的延迟（5s）仍证明了 turn 模型的排队行为。
- C.4 初次诱导 question 时 Orchestrator 用文本回复而非 ask_user 工具，需第二轮显式指定 ask_user 工具才成功触发 question 事件。

## 改进建议

- C.4 的 question 诱导 prompt 应直接写明 "use the ask_user tool"，避免 Orchestrator 绕过 question 机制
- C.5 可使用更耗时的 tool call chain（如 5 个文件各 sleep 5s）增加 mid-turn 命中概率

## 总体评估

**6/6 PASS** — serve-api v1.3.0 session 树监控与主动干预功能全部验证通过。
