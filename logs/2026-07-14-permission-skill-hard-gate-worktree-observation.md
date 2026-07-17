# Permission Skill 硬门未提交实现观察

**为什么**: Session 启动核验发现 work-one 已出现 permission template 返工相关代码改动，但已有日志只记录 Blueprint/返工契约，未记录当前实现态。

**改了什么**:
- `.opencode/plugin-handlers/before/skill-policy.ts` — 未提交改动将 warn-only 内存判断改为 DB attestation hard gate。
- `.opencode/service/session/skill-attest.ts` — 未提交改动增加 session/agent/task/required-set/file-hash 绑定和 fail-closed 校验。
- `.opencode/project.config.json` — 未提交改动追加 required Skill，并调整 active before order。

**决策**: 本日志仅记录 2026-07-14 静态 worktree 观察；未运行该批改动的组件、runtime 或 live LLM E2E，不标记 permission template 或 T-PT-004 完成。
