# 2026-08-03: 跨平台通用化蓝图创建
## 为什么
- 用户诉求：Windows Git Bash + WSL Ubuntu 双兼容 + skill 不含路径
- 经 4 轮 handoff 双重复审 + 用户语义澄清后定稿 v3 解决思路
- v3 思路已通过 M3+GLM-5.2 第二轮双重复审
## 改了什么
- 新建 blueprints/blueprint-cross-platform-universality.md（基于 v3 思路，约 250 行）
- blueprints/INDEX.md 加 1 行登记
- 新建本日志
## 决策
- 复用既有 WORK_ONE_ROOT + QODERWORK_ROOT 合约，不发明 QW_ROOT
- 不引入 tree-kill 包（M3 + GLM-5.2 实测：bun parent SIGTERM 杀整个后代树）
- outcome-contract 不需 gen-2 amendment（handoff L294 inline boundary-correction 足够）
- skill 通用化按 3 buckets: command-template / wsl-wrapper / prose
- 必修 N2（skill WSL-only framing）+ N3（debug-environment-toolkit 12 处）
## 更新了什么文档
- blueprints/blueprint-cross-platform-universality.md（新建）
- blueprints/INDEX.md（加 1 行）
- logs/2026-08-03-blueprint-cross-platform-universality.md（新建）
