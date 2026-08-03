# 2026-08-03: 缺失依赖清单修正（基于 M3+GLM-5.2 双重复审）

## 为什么
- 主会话原"Windows Git Bash 下缺失依赖汇总"含 4 处错误/遗漏
- 经 M3 + GLM-5.2 串行复审 + 主会话 14 项独立验证后修正

## 改了什么
- handoff/native-windows-verification.md L272 实测章节（推翻旧"无 env fallback"错误陈述）+ L278 详细注释 + L294 UNVERIFIED 重分类注 + L296-351 下一步建议整段重写 + L362/L366 关键发现 #1/#5 措辞更新（按双重复审）
- 新建本日志

## 决策
- P0 CRITICAL: 4 个 TS import /home/zhaoge + opencode 二进制 + /proc/<pid> 设计级不兼容
- P1 HIGH: SIGTERM 信号语义（已收窄）+ 51 个 shell /home/zhaoge + setsid 缺失
- 推翻原"NEW-3 sse-daemon.ts 无 env fallback"——实测有 fallback

## 更新了什么文档
- handoff/native-windows-verification.md（仅 L272 + L278 + L294-351 区域；L1-271 完全未变，append-only 严格遵守）
- logs/2026-08-03-update-missing-dependency-corrections.md（新建）
