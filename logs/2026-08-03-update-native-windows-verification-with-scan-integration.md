# 2026-08-03: 集成 scan 与准废弃声明

## 为什么
- M3+GLM-5.2 串行复审 + 主会话 Final Gate 完成
- 发现 scan 文档存在 1 HIGH + 5 MEDIUM + 4 LOW 质量缺陷，核心 BLOCKING 结论仍可信
- 决定将 scan 准废弃并把有效内容整合进 native-windows-verification.md

## 改了什么
- handoff/native-windows-verification.md 末尾追加"集成 scan 与准废弃声明"章节
- 新建本日志
- 物理删除 audits/wsl-path-compat-scan/2026-07-31-scan.md（untracked）

## 决策
- scan 准废弃但核心结论保留（§2.0 仍 BLOCKING，§2.1/§2.2 已通过 ff0633b 缓解）
- 集成映射表确认与 21-item 清单仅 #10 + 2 漏项重叠，其余互补
- 建议未来 21-item 补 #22（symlinks）+ #23（markdown 命令模板）

## 更新了什么文档
- handoff/native-windows-verification.md（追加章节）
- logs/2026-08-03-update-native-windows-verification-with-scan-integration.md（新建）