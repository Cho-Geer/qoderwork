# Retire Scout And Standardize On Explore

**为什么**: OpenCode 当前官方/运行态对 Scout 已经分叉，work-one 继续保留 Scout 语义会让调度、技能和知识流程产生误导。目标是把当前有效路径统一到 `explore` / `Knowledge-Curator`，并删除已退役的 Scout 脚本。

**改了什么**:
- `/home/zhaoge/workspace/opencode/work-one/.opencode/agents/Orchestrator.md` — 移除 Scout-like / Scout-style 路由描述，改为 `explore` 与 `Knowledge-Curator` 分工
- `/home/zhaoge/workspace/opencode/work-one/.opencode/plugin-handlers/system/skill-summary.ts` — 将 Scout 升级建议改为 research escalation，日志事件改为 `research_escalation_suggested`
- `/home/zhaoge/workspace/opencode/work-one/.opencode/service/dispatch/agent-target.ts` — 移除 `scout` native executor，并对旧 `scout` 调用改为显式退休报错
- `/home/zhaoge/workspace/opencode/work-one/.opencode/skills/preflight-lite/*` + `context7-first`/`dispatch-protocol` — 全部收口为 `explore` / `Knowledge-Curator` 语义
- `/home/zhaoge/workspace/opencode/work-one/.opencode/scripts/knowledge/*` — 删除 `scout-extractor.ts`，去掉 `scout-extracts`/`source=scout` 特判

**决策**: 这次只清理当前运行链路和会被 active skill/prompt 读取的文档，不追打 `docs/review/` 与 state backup 里的历史 Scout 文案。对旧 `scout` 调用保留硬退休错误，而不是静默兼容到别的 agent，避免旧调用被悄悄路由错目标。
