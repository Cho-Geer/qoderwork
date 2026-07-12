# E2E Test: P1 补完 + P2 + P4 (2026-07-07)

## 测试范围

| 组 | 覆盖 | 测试数 |
|:---:|------|:---:|
| P1: dispatch_key column | dispatch_queue PRAGMA 验证 | 3 |
| P1: Grant lifecycle | create → bind → has → consume 全流程 | 9 |
| P1: bindGrant edge cases | 不存在的 dispatch_key | 1 |
| P1: TTL expiration | 1ms TTL 过期后 bind/has 失败 | 3 |
| P2: safe_framework_edit | 文件存在 + tool export | 2 |
| P2: codegraph enforcement | tools 数组包含 safe_framework_edit | 1 |
| P4: exempt_agents | 4 个 agent 均不被豁免 | 4 |
| P2: Path matching | /**, /*, exact, 非匹配路径 | 7 |

## 结果

**33 passed, 0 failed, 33 total**

## 关键验证点

1. `bindGrant()` 正确将 pending grant 转为 bound，绑定 child_session_id
2. `hasGrant()` 路径匹配支持 `/**`（递归）、`/*`（单层）、exact 三种模式
3. 过期 grant（1ms TTL）无法 bind 也无法 hasGrant
4. `safe_framework_edit` tool 存在且正确导出
5. `codegraph.ts` 拦截列表已包含 `safe_framework_edit`
6. Super-Admin 不再被 CodeGraph 豁免
