# Live LLM Dispatch E2E: 部分闭环验证

**为什么**: 用户明确指出之前的 "27 PASS" 只是 DB/函数级模拟验证，缺少 live LLM E2E 证据。本次通过 serve API 创建真实 Orchestrator session，触发 dispatch_subagent，验证 live 链路的实际行为。

**方法**:
- 创建新 Orchestrator session（`ses_0c51d90dcffejvg36Y49xI8AM3`，标题 `[E2E-TEST] Live dispatch privilege verification`）
- 发送最小化 read-only prompt：调用 `dispatch_subagent(agent_type="build", task=读取 safe_framework_edit.ts)`
- SSE 监控 + DB 查询交叉验证

**改了什么**:
- `qoderwork/scripts/live-llm-dispatch-e2e.ts` — 新增 live E2E 测试脚本（serve API + SSE 监控 + bun:sqlite DB 查询）

**发现**:

### 已验证的 live 链路（部分闭环）

| 环节 | 证据 | 状态 |
|------|------|:----:|
| 1. 真实 Orchestrator LLM 推理 → 决策调用 dispatch_subagent | SSE: 3 个 tool 事件（pending/running/completed），callID=`call_00_Gtc5pR1Nx4tAVetsRgct9544` | ✓ LIVE |
| 2. dispatch_subagent → dispatch_queue 写入 | DB row id=23: `agent_type=build`, `dispatch_key=439f72ec...`, `parent_session_id=ses_0c51...`, `status=pending` | ✓ LIVE |
| 3. dispatch_queue 含 exact binding 三字段 | DB row 含 `dispatch_key`、`parent_session_id`、`call_id`（虽 call_id 为 null） | ✓ LIVE（dispatch_key + parent_session_id 写入 OK；call_id 未写入待查） |

### 未触发的环节（因果分析）

| 环节 | 观察 | 根因 |
|------|------|------|
| 4. createGrant() 创建 grant | grants 表无新行 | `DISPATCH_PRIVILEGE` env 未设置。router.ts 只在 `dispatch_privilege` flag 存在时设置 env；本次 read-only prompt 未请求 framework_maintenance 特权 |
| 5. router 生成 dispatchKey 并传递 | dispatch_key 值来自 dispatch-subagent.ts 内部的 `result.dispatchToken`（promptHash）fallback，非 router 生成 | router 的 dispatchKey 生成逻辑也受 `dispatch_privilege` 触发，本次未激活 |
| 6. child session 创建 + grant 绑定 | session_map 无 child row；queue 停留在 `pending` | 未触发。consume 机制（marker-consume.ts）依赖 Orchestrator 输出 marker token，本次 LLM 直接 finish="tool-calls" 未输出 marker |
| 7. safe_framework_edit 双门验证 | 未触发 | 上游环节未到位 |

**决策**:
- **证据等级重新校准**：live LLM E2E 只闭环了"LLM → dispatch_subagent → queue 写入"前 2.5 步，不足以称为"完整链路验证"
- **证据缺口**：grant 创建 + bind + 双门验证仍需以下条件之一达成：
  - (a) 发送触发 framework_maintenance 特权的真实 dispatch prompt（风险：LLM 可能 edit 真实 framework 文件）
  - (b) 手动模拟 router 设置 DISPATCH_PRIVILEGE env 后调用 dispatch-subagent.ts（中等证据）
  - (c) 等待生产 Orchestrator 在正常工作中触发 dispatch privilege（被动）
- **修正结论**：之前日志中的"完整 dispatch→queue→grant→bind→double gate→consume 链路验证"表述应改为"DB/函数级集成验证通过；live LLM E2E 部分闭环（前 2.5 步）"

**验证数据**:

```
# dispatch_queue row (live, from Orchestrator LLM reasoning)
id=23, status=pending, agent_type=build
dag_task_id=ed33126b-4751-4dda-bee6-193a5735d706
dispatch_key=439f72ec88dbabd8813335ad2f7b87472b9db52bf3f72a6f9776e66391c8103c
parent_session_id=ses_0c51d90dcffejvg36Y49xI8AM3
call_id=null
created_at=1783399355175

# SSE events (live)
dispatch_subagent status=pending ts=1783399354688
dispatch_subagent status=running ts=1783399355196
dispatch_subagent status=completed ts=1783399355196

# LLM token usage
input=78649, output=98, reasoning=447, cache_read=78208
cost=0.0113824424
```

**证据矩阵（更新后）**:

| 环节 | DB/函数级 | Live LLM E2E |
|------|:---:|:---:|
| dispatch_subagent → queue 写入 | ✓ (17 PASS) | ✓ LIVE |
| queue 含 exact binding 三字段 | ✓ (17 PASS) | ◐ (dispatch_key + parent_session_id OK; call_id null) |
| createGrant | ✓ (integ 10 PASS) | ✗ (env 未设置) |
| bindGrant (session.created) | ✓ (integ 10 PASS) | ✗ (child 未创建) |
| hasGrant + path match | ✓ (17 PASS) | ✗ |
| CodeGraph 双门 | ✓ (integ 3 PASS) | ✗ |
| consume + grant.status=consumed | ✓ (17 PASS) | ✗ |

**结论**: 大方向成立，但"完整 dispatch privilege 链路"只有前 2.5 步有 live 证据。后续环节的证据仍来自 DB/函数级模拟。

---

## 改进轮次（同日后续）

**为什么**: 前一轮 live E2E 发现 2 个具体缺陷——(a) `call_id` 未写入 dispatch_queue（exact binding 三字段缺其一），(b) SSE watcher 基于 byte offset + readSync 在 WSL 下存在 race/buffer 问题（file 已有 488 事件但 watcher 看到 0）。本轮修复这两项并用同一脚本验证。

**改了什么**:
- `.opencode/service/dispatch/router.ts` — `DispatchInput` 新增 `callId?: string` 字段；`dispatch()` 解构 `callId` 并通过 `DISPATCH_CALL_ID` env 传递给 `dispatch-subagent.ts`
- `.opencode/tools/dispatch_subagent.ts` — 从 tool context 读取 `callID` 并传入 `dispatch({callId})`
- `.opencode/scripts/command-tools/dispatch-subagent.ts` — 读取 `DISPATCH_CALL_ID` env 并作为第三个可选参数传给 `dbEnqueueDispatch()`
- `qoderwork/scripts/live-llm-dispatch-e2e.ts` — SSEWatcher 重写为 line-count 基于轮询（避免 byte offset race）；DB path 修正为 `framework-state.db`；表名 `grants`→`dispatch_privilege_grants`；assertions 分为 MUST-PASS（核心链路）和 INFORMATIONAL（privilege 依赖）

**验证结果（live, 重启 serve 后，session `ses_0c510072cffeiWECQmx3EALYZt`）**:

```
dispatch_subagent callID (SSE): call_4gztlkw1jj5abvs3hgksq0lr
dispatch_queue row id=25:
  agent_type=build
  dispatch_key=c31c4c814d9e83564850ef11ee0a18a32d4c3e057ab6781bf031f4f1cebce9aa
  parent_session_id=ses_0c510072cffeiWECQmx3EALYZt
  call_id=call_4gztlkw1jj5abvs3hgksq0lr   ← 之前 null, 现已修复
  status=pending
```

**Assertion**:
- ✓ dispatch_subagent tool call observed (live)
- ✓ dispatch_queue has row with dispatch_key
- ✓ dispatch_queue has row with parent_session_id
- ✓ **dispatch_queue has row with call_id (exact-binding fix verified)** ← 新增验证点
- ◐ child session / privilege grants 未触发（read-only 设计）

**4 PASS / 0 FAIL**

**证据矩阵（改进后）**:

| 环节 | DB/函数级 | Live v1（改进前）| Live v3（改进后）|
|------|:---:|:---:|:---:|
| dispatch_subagent → queue 写入 | ✓ | ✓ | ✓ |
| queue 含 dispatch_key | ✓ | ✓ | ✓ |
| queue 含 parent_session_id | ✓ | ✓ | ✓ |
| **queue 含 call_id** | ✓ | ✗ null | **✓ LIVE** |
| createGrant | ✓ | ✗ | ◐ (read-only) |
| bindGrant (session.created) | ✓ | ✗ | ◐ (read-only) |
| hasGrant + path match | ✓ | ✗ | ◐ |
| CodeGraph 双门 | ✓ | ✗ | ◐ |

**结论修正**:
- 改进前："前 2.5 步 live 闭环"
- 改进后：**"前 3.5 步 live 闭环"**——exact binding 三字段（dispatch_key + parent_session_id + call_id）现已全部 live 验证
- 剩余环节需 framework_maintenance 特权激活；read-only live 测试 deliberately 不触发，避免修改生产 framework 代码

**仍存在的风险/改进空间**:
1. 特权路径的 live E2E 仍未闭环。建议在隔离的 `.task_temp/_test/` framework 目录下构造一个允许任意修改的 dispatch_privilege 测试
2. SSEWatcher 的 line-count 方案在 SSE 文件增长到 MB 级后效率下降；可改用 `fs.fstatSync(fd)` 或 `tail -F` 子进程
3. child session 创建路径未在本次 live 中验证（依赖特权激活），留作后续
