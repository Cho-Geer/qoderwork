# GitHub MCP 写保护 Live E2E 现状报告

## 执行标识
- 执行需求唯一ID: `resp-20260708-004`
- 执行时间戳: `2026-07-08`
- 执行范围: `GitHub MCP read/write live smoke` 证据整理与现状报告

## 本次任务目标
- 保留意外生成的测试文件，不继续做代码修改。
- 整理 `serve-api` 下 GitHub MCP 写保护的真实运行证据。
- 输出当前可宣称结论、不能宣称的结论、以及后续风险点。

## 执行环境
- Serve URL: `http://localhost:4096`
- 初始健康检查版本: `1.17.14`
- 重启后健康检查版本: `1.17.15`
- 观测链路: `serve API` + `/tmp/sse-events.jsonl` + `/tmp/sse-daemon.log`

## 关键 Session
- 首次只读 smoke: `ses_0c0ba7ec8ffeGJQKl7Hxq50eby`
- 首次写入 smoke: `ses_0c0ba19f1ffeQ6ODm494Uegs4K`
- 重启后只读 smoke retry: `ses_0c0aa58a6ffeb6JqjM4Y3akjwg`
- 重启后写入 smoke retry: `ses_0c0aa589affelX5JJe2ZItT5Tz`

## 证据摘要

### 1. 首次只读 smoke
- 指令要求直接调用 `github_get_issue(owner=octocat, repo=Hello-World, issue_number=1)`。
- 结果: 成功。
- 返回结论: `{"tool":"github_get_issue","succeeded":true}`。
- 说明: GitHub MCP 读路径在 live 环境中可正常放行。

### 2. 首次写入 smoke（重启前）
- 指令要求直接调用 `github_create_issue`，且禁止改走 `safe_gh_*`。
- 结果: **未被阻断**，真实创建了 `https://github.com/octocat/Hello-World/issues/10376`。
- 说明: 此次证据表明旧 serve daemon 仍在跑旧代码/旧插件链，不能据此判定新 hook 无效。

### 3. Serve 重启
- 原因: `serve-api` 规范要求修改 `opencode.json` / plugin / hook 后必须重启 daemon，旧 daemon 不热重载。
- 动作: 停掉旧 `4096` 端口上的 `opencode serve`，重新启动 `start-serve.ts`。
- 结果: `serve` 版本从 `1.17.14` 变为 `1.17.15`。

### 4. 重启后只读 smoke retry
- 指令仍要求直接调用 `github_get_issue`。
- 结果: 成功，live read allow 再次成立。
- 附带现象: session 输出中出现一个 `patch` 事件，落到未跟踪文件 `.opencode/service/dispatch/__tests__/framework-maintenance.test.ts`。

### 5. 重启后写入 smoke retry
- 指令要求直接调用 `github_create_issue`，且禁止改走 `safe_gh_*`。
- 结果: **被阻断**。
- 精确错误:

```text
[FW-ENFORCE][REPO-OP] Direct GitHub MCP remote_write operations are blocked.
Use first-class repo tools with remote_repo_write grant + human confirmation instead.
Tool: github_create_issue

Read tools: github_get_*, github_list_*, github_search_*
Write tools: safe_repo_push, safe_gh_pr_create, safe_gh_pr_comment, safe_gh_issue_comment
```

- 说明: 这条证据证明 active hook 在新 serve daemon 上已真实生效。

## 当前可宣称结论
- GitHub MCP 读路径 `github_get_issue` 在 live serve API 环境下可正常放行。
- GitHub MCP 直连写路径 `github_create_issue` 在 **重启后的新 serve daemon** 上会被 active hook 正确阻断。
- `serve` 修改/插件变更后必须重启 daemon，这一条不是理论要求，而是本次 live 证据已经实测验证的运行事实。

## 当前不能直接宣称的结论
- 不能宣称“首次 live smoke 就通过”。因为重启前确实发生了真实漏拦截，并创建了外部 issue。
- 不能宣称“完整 remote write E2E PASS”。当前只有 direct GitHub MCP write blocked smoke，没有 remote positive live path。
- 不能宣称“工作树无副作用”。重启后只读 smoke retry 产生了未跟踪文件，需要后续单独处理。

## 当前风险与现状
- 外部副作用: 已真实创建 `octocat/Hello-World#10376`，后续如有需要应人工关闭或备注。
- 工作树副作用: 保留未跟踪文件 `.opencode/service/dispatch/__tests__/framework-maintenance.test.ts`。
- 状态说明: 该文件当前不是已提交代码的一部分，但已被本次 live session 真实落地。

## 建议的审计结论
- GitHub MCP 写保护审计项可从“未做 serve API live smoke”升级为“已完成 live smoke，结论成立，但必须附带 daemon restart 前后差异说明”。
- 文档表述建议使用:
  - `PASS`：针对“重启后 direct GitHub MCP write blocked smoke”
  - `IMPORTANT CAVEAT`：必须重启 serve daemon，否则可能继续命中旧代码路径
  - `OPEN`：未跟踪文件和外部 issue 后续清理

## 注意事项
- 本报告阶段未修改任何代码。
- 本报告阶段按用户要求保留了意外文件，不做删除或回退。
- `runAuditCleanup()` 的方案 B 两类计数尚未开始实施，应作为下一轮独立任务处理。
