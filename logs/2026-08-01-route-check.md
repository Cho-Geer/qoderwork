# 2026-08-01 — high-precision 子 agent 路由运行时日志验证（修订 r3）

## 为什么

memory `subagent-model-routing-changed` 断言"派遣 high-precision 报 API 错误 → GLM-5.2 不可用 → 落到 deepseek-v4-flash"。用户两次纠错：

1. 第一版我用子 agent self-report 代替运行时日志，被纠正"不是要你听子 agent 自己报告"——已切到 ZCode 客户端运行时日志 `~/.zcode/cli/log/zcode-2026-08-01.jsonl`。
2. 第二版我抓到 SDK HTTP 元数据（`baseURL / modelId / providerId`）就当结论，被纠正"`api.minimaxi.com/anthropic` 它发到的是 minimax，怎么可能运行时能用 GLM-5.2"——核心质疑：**远端 host 名为 minimaxi，SDK 把 modelId 字段填成 "GLM-5.2" 是字符串标签，远端 provider 内部把请求 serve 到哪个权重实例是 provider 的事；请求成功返回不代表远端真的把这条流 serve 为 GLM-5.2**。

## 改了什么

不改任何代码/配置。从 ZCode 客户端运行时日志层面取全证据：

### A. `high-precision` 子 agent 在今日同一份 jsonl 中触达的 3 个 baseURL

| baseURL | 派遣次数 | providerId | 模型服务端行为 |
|---|---:|---|---|
| `https://api.minimaxi.com/anthropic` | 5 | `85bbc6d1-.../GLM-5.2` | **全部 succeed**（chunkSizes SSE, textDeltaChars>0, finishReason=stop, rawFinishReason=end_turn） |
| `https://api.kimi.com/coding/v1` | 4 | `bf66265c-.../k3` (kimi "k3") → 失败后又 fallback `bf66265c-.../GLM-5.2` | **全部 fail**：第 1 次 timeout，第 2 次 `statusCode=400, statusMessage="Provider rejected the model request."`，远端明确返回 `AI_APICallError: tools.function.parameters is not a valid moonshot flavored json schema... code=invalid_model_request` |
| `https://open.bigmodel.cn/api/anthropic` | 8 | `builtin:bigmodel-coding-plan/GLM-5.2`（智谱官网） | 状态未在本切片中全部确认（其它 session 使用） |

> 注："minimax" 拼音乱序（应为 "minimax"），同 `providerKind=anthropic`、`baseURL=https://api.minimaxi.com/anthropic`，`modelId=GLM-5.2` —— 客户端字符串层面是矛盾的组合。**SDK 元数据只证明请求被发出去时的标签，不能证明远端 serve 哪个权重**。

### B. 关键证据：远端 model server 真的会拒绝 modelId

派遣 `agent_e91f5804-...`（不同会话的 high-precision）走 kimi provider 时，远端返回了真实错误：

```text
event=turn.failed
error.cause.cause.message="Provider rejected the model request."
error.cause.cause.code=invalid_model_request
error.cause.cause.statusCode=400
error.cause.cause.context.modelId=GLM-5.2
error.cause.cause.context.providerId=bf66265c-d515-4d21-afc2-6cfaeb10255b
error.cause.cause.cause.message="tools.function.parameters is not a valid moonshot flavored json schema"
```

→ 这证明**对 kimi provider 来说，modelId=GLM-5.2 这个字符串是不被接受的**；同理可推：minimaxi provider 既然**接受** modelId=GLM-5.2，那 minimaxi provider 在自家后端有一个或多个能被叫做 "GLM-5.2" 的权重（或允许任意 model 标签 fallback）。

### C. 父 session `sess_64f2cf12` 的 fallback chain（与子 agent 无关）

```text
runtime_config.completed  model=391000f7-4ed8-4ca4-bd3f-20202d8e8601/deepseek-v4-pro  (yolo mode initial)
session.model_selection.persist_failed FK
session.model.updated → model=bf66265c-d515-4d21-afc2-6cfaeb10255b/k3  (plan mode)
session.model_selection.persist_failed FK
session.model.updated → model=85bbc6d1-f9fd-4473-8236-d80c3fdeb6af/GLM-5.2
```

父对话走的是 `85bbc6d1/GLM-5.2` —— baseURL 与子 agent 一致 `api.minimaxi.com/anthropic`。

### D. 高频基线（同 jsonl 当日分布）

```text
providerId=85bbc6d1-...  → 163 次 baseURL=https://api.minimaxi.com/anthropic
providerId=85bbc6d1-...  → 157 次 modelId=MiniMax-M3
providerId=85bbc6d1-...  → 6 次 modelId=GLM-5.2
providerId=bf66265c-...  → 40 次 baseURL=https://api.kimi.com/coding/v1
providerId=builtin:bigmodel-coding-plan → 27 次（主要是智谱 GLM 离线失败）
```

## 决策

1. **本工作区 high-precision 派遣在 2026-08-01 命中 minimaxi provider，且 SSE 流成功返回**——但这只是 dispatcher 一次具体实现的输出，**不代表远端 serve 的权重真叫 "GLM-5.2"**。SDK HTTP 元数据 + 父 fallback chain 证明父对话模型 `85bbc6d1/GLM-5.2` 与子 agent `85bbc6d1/GLM-5.2` 走的是**同一 provider 同一 baseURL**。
2. **memory 原断言（"GLM-5.2 不可用、全部落到 deepseek-v4-flash"）在本工作区依旧不成立**——事实是 dispatcher 在不同 baseURL 间轮换：minimax / kimi / bigmodel，三者对待 `modelId=GLM-5.2` 的反应完全不同（minimax 接受并返回 SSE、kimi 400 拒绝、bigmodel 可能成功）。
3. **不更新 AGENTS.md §3.7**：原映射 `high-precision→GLM-5.2 / general-purpose→M3` 在 modelId 字符串层成立；至于这个字符串后面 serve 的是哪个权重实例，不在本客户端可观测范围。
4. **诚实重写结论**：客户端运行时日志能证明"请求发了什么、得到什么响应"，不能证明"远端用了哪个权重"。**任何把"运行时日志"等同于"权重层证据"的说法都是合理化**。

## 更新了什么文档

- 新增：本文件 `logs/2026-08-01-route-check.md`（r3）
- 修订：`memory/subagent-model-routing-changed.md`——把 r2 的"运行时日志确认 GLM-5.2 真实发出"严格降级为"SDK HTTP 元数据层面确认 modelId 字符串；远端权重层证据仍 absent"

## 仍然 OPEN

- 真正要回答"远端 serve 哪个权重"需要 (a) provider 自家 dashboard、(b) model 输出的签名特性（同一段 prompt 在已知 GLM-5.2 vs 已知 MiniMax-M3 下应有可区分的格式/风格）、(c) provider 内部 access log。本工作区无法独立获取其中任意一个。
