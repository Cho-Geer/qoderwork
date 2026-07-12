# serve-api skill: 修复 /event curl 示例

**为什么**: E2E v12 测试中发现 `curl -N -s http://localhost:4096/event` 无限挂起（即使带 Accept: text/event-stream header）。Bun fetch() 可正常连接。skill 中的 direct curl 示例是错误的。

**改了什么**:
- `.qoder/skills/serve-api/SKILL.md` — SSE daemon 管理节增加 ⚠️ 警告：curl 无法连接 /event；Section B 的 SSE 启动改为 sse-daemon.ts；版本 1.3.0→1.3.1
- `.qoder/skills/serve-api/reference.md` — Section B.2 的 curl 示例替换为 sse-daemon.ts 启动命令

**决策**: sse-daemon.ts（Bun fetch 实现）是 SSE 监控的唯一可靠方式。REST polling（GET /session/{SID}/message）作为兜底路径保留。
