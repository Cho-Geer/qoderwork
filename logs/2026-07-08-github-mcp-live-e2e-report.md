# GitHub MCP Live E2E 现状整理

**为什么**: 用户要求保留意外生成文件，先不继续代码修改，只整理 GitHub MCP 写保护的真实 serve API 证据与当前状态。

**改了什么**:
- `plans/git-write-grant/2026-07-08-GitHub-MCP-live-E2E-现状报告.md` — 汇总首次 smoke、重启后 smoke、外部 issue、副作用文件、可宣称结论与未决风险
- `logs/2026-07-08-github-mcp-live-e2e-report.md` — 记录本次证据整理结论

**决策**: 保留 `.opencode/service/dispatch/__tests__/framework-maintenance.test.ts` 不动；当前只确认“重启后 direct GitHub MCP write blocked smoke PASS”，不继续推进 `runAuditCleanup()` 方案 B，也不把结论升级成完整 remote write E2E PASS。
