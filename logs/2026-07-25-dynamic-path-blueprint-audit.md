# 路径动态化蓝图审计

- 原因：核实路径动态化蓝图的事实、方案和遗漏。
- 结论：消除活跃运行路径硬编码合理，但旧版统计、静态 import 范围和 IDE 假设不足以实施。
- 证据：当前扫描为 1,758 处/451 文件；Bun `.env` 与动态 import 实测通过；bootstrap import 组件测试 2/2 PASS。
- 决策：采用“解析契约 + 机器本地路径清单 + 客户端适配器”，不把根 `.env` 或未验证的插值语法当单一方案。
- 风险：Trae 必须在 Windows host 实测；CodeBuddy 的变量展开仍为 gate；未运行 runtime/live-LLM-E2E。

## 文档更新

- 更新：`blueprints/blueprint-dynamic-path-resolution.md`（v1.1.0）。
- 更新：`documents/INDEX.md`（新增蓝图条目与阅读入口）。
- 新增：本日志；`logs/INDEX.md` 将在本任务内同步。
