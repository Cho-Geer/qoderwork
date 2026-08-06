# 2026-08-03 — Runtime Model Identification (3-agent dispatch check)

## Task

用户要求：**并行派遣 3 个 subagent，仅为了确认它们实际运行时使用的大模型，必须从实际运行时日志中确认，禁止子 agent 自报。**

## Method

按 [[runtime-model-identification]] memory 的方法：

1. 派遣 3 个 subagent（`Explore` / `general-purpose` / `high-precision`），最小任务（仅 echo + 返回一行 OK），`run_in_background=true`。
2. 给子 agent 的 prompt 明确**禁止**自报模型（"do not attempt to determine or report which model you are running on"）。
3. 等待 3 个 agent 全部完成（实际 ≤ 16.5 秒）。
4. 从 `~/.zcode/cli/log/zcode-2026-08-03.jsonl` 中按 `agentId` 提取 `model.network.completed` 事件的 `context.{modelId, baseURL, providerId, model, agentType}`。
5. 用全日志 modelId 分布做交叉验证。

## Results — actual runtime model identification (SDK metadata layer)

| subagent_type | agentId (prefix) | agentType in log | modelId | baseURL | providerId |
|---|---|---|---|---|---|
| Explore | `agent_26966027-…` | Explore | **MiniMax-M3** | https://api.minimaxi.com/anthropic | 85bbc6d1-f9fd-4473-8236-d80c3fdeb6af |
| general-purpose | `agent_1d89eb25-…` | general-purpose | **deepseek-v4-flash** | https://api.deepseek.com | 391000f7-4ed8-4ca4-bd3f-20202d8e8601 |
| high-precision | `agent_7cf26e16-…` | high-precision | **k3** | https://api.kimi.com/coding/v1 | bf66265c-d515-4d21-afc2-6cfaeb10255b |

每个 agent 都出现 2 次 `model.network.completed`（首次响应 + tool 后第二次请求），3 个 agent 都对应完整 turn 周期（`turn.started` → `model.network.completed` → `turn.completed`）。

Verified-by (this is the only authoritative model identification):

```bash
python3 -c "..."  # see "Repro commands" below
# Output:
#   Explore:          MiniMax-M3            @ api.minimaxi.com/anthropic
#   general-purpose:  deepseek-v4-flash     @ api.deepseek.com
#   high-precision:   k3                    @ api.kimi.com/coding/v1
```

## CRITICAL: Memory contradiction detected

[[runtime-model-identification]] memory 声称的"confirmed mappings"是：

| agentType | memory says | actual today (2026-08-03) |
|---|---|---|
| Explore | MiniMax-M2.7 | **MiniMax-M3** |
| general-purpose | MiniMax-M3 | **deepseek-v4-flash** |
| high-precision | GLM-5.2 | **k3** |

**零项命中**。三个 agentType 在本次实际跑出来的 modelId 与 memory 的"已确认映射"全部不同。

### Tally of ALL model.network.completed modelId values today (cross-check)

| modelId | count today |
|---|---:|
| MiniMax-M3 | 1085 |
| deepseek-v4-flash | 242 |
| GLM-5.2 | 233 |
| kimi-k3 | 34 |
| MiniMax-M2.7 | 15 |
| k3 | 2 |

→ 今天 6 个 modelId 都被使用过，memory 描述的 3 个都存在；但**本次派遣命中的不是 memory 列出的那 3 个**。

### Plausible explanations

1. **Routing policy is dynamic**：同一 `subagent_type` 字符串在不同时间会被路由到不同 provider；memory 把"某次观察到的 mapping"误写成了稳定事实。
2. **Health-based fallback**：`high-precision` 在 `kimi-k3 on Volces` 429 后（参见 [[high-precision-routes-broken-kimi-k3]]）fallback 到 `k3 on kimi.com`；`general-purpose` 可能因为 Minimax M3 健康度问题而走 deepseek。
3. **Agent capability tier ≠ provider endpoint**：memory 暗示"Explore = 轻量模型、M2.7"是合理推断，但 ZCode SDK 实际 routing 决策不依赖该隐含映射。

→ **下次派遣前，先跑本日志里的 repro 命令拿到当日实测 mapping，再据其选 `subagent_type`。** memory 的"confirmed mappings"表格不可信。

## Caveat (per [[runtime-model-identification]] + logs/2026-08-01-route-check.md:67)

> 客户端运行时日志能证明"请求发了什么、得到什么响应"，**不能证明"远端用了哪个权重"**。

本表仅证 **SDK 请求层**：`model.network.completed.context` 声明 `modelId=X` 被发送到 `baseURL=Y`，并收到 200 响应。要证明远端实际权重，需要另外的 oracle 验证。

**正确表述**：

- ✅ "SDK 请求携带 `modelId=deepseek-v4-flash` 到 `baseURL=https://api.deepseek.com`"
- ❌ "agent 跑在 deepseek-v4-flash 上"

## Repro commands

```bash
python3 << 'PYEOF'
import json
LOG = r'C:/Users/USER/.zcode/cli/log/zcode-2026-08-03.jsonl'
agents = {
    'Explore':         'agent_26966027-a5f5-4a54-b7c3-3a5b57dfe1df',
    'general-purpose': 'agent_1d89eb25-1718-491f-a3e5-f0cf9c5b94b0',
    'high-precision':  'agent_7cf26e16-f7d7-4f2d-9fe3-942633d94de3',
}
for label, aid in agents.items():
    with open(LOG) as f:
        for line in f:
            j = json.loads(line)
            if j.get('event')=='model.network.completed' and aid in j.get('sessionId',''):
                ctx = j['context']
                print(f'{label:18s} {ctx["modelId"]:20s} {ctx["baseURL"]}')
                break
PYEOF
```

## Cross-references

- [[runtime-model-identification]] — 需要修正"confirmed mappings"段
- [[high-precision-routes-broken-kimi-k3]] — high-precision 429 fallback 历史
- `logs/2026-08-01-route-check.md:67` — SDK metadata ≠ weight caveat 原始出处
