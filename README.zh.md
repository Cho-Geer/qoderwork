# qoderwork

> Personal AI Agent collaboration workspace / 个人 AI Agent 协作工作区 / 個人 AI エージェント連携ワークスペース

本仓库是基于 **OpenCode 框架**构建的**个人 AI Agent 协作治理工作区**。
集中管理 Plan-Audit 归档、Agent 编排,以及 Skill / Rules / Memory 的运行规范。

---

## 📌 这是什么

qoderwork 围绕四大支柱构建:

- **Plan-Audit Archiver** —— 设计 → 审计 → 复盘,以不可变的时间序列制品留存
- **Agent Orchestration** —— OpenCode / Codex / Qoder / Trae / WorkBuddy 等 AI 工具在统一规则下运行
- **Skill / Memory Governance** —— 对 Agent 的 Skill 与持久 Memory 做周期性一致性检查
- **Governance First** —— 纪律与验证优先于交付速度

简而言之:**面向独立开发者的 "Plan–Audit–Code" 三层工作区**。

---

## 🏗 结构

| 区域 | 角色 | 主要内容 |
|---|---|---|
| `blueprints/` | 设计 (Plan 层) | 任务定义、依赖、出口条件 |
| `audits/` | 审计日志 (Audit 层) | P0-2 / P0-3 / task-lens-m1 等审计记录 |
| `documents/` | 领域文档 | 业务领域知识、设计判断记录 |
| `e2e-evidence/` | 运行证据 | Agent 执行与验证日志 |
| `AGENTS.md` / `RULES.md` / `MEMORY.md` | 会话级规则 | Agent 行为规范、判断标准、持久记忆 |
| `.codebuddy/` `.qoder/` `.trae/` `.workbuddy/` `.kimi-code/` `.codex/` `.codegraph/` | 工具镜像 | 各 AI 工具的本地配置 |

---

## 🔁 典型工作流

```
blueprints/   →   audits/   →   实现 + commit   →   e2e-evidence/   →   MEMORY.md
   设计            审计            编码                验证               更新
```

---

## ⚙️ 技术栈

- TypeScript (主语言)
- Bun (运行时)
- OpenCode Framework (Agent 基础)
- Conventional Commits
- Worktree 式开发 (`.worktrees/` 已加入 `.gitignore`)

---

## 📊 活跃度

> 过去 12 个月 GitHub 贡献:约 600 commits / 200 issues / 38 PRs
> 主要集中在 2026-03 ~ 06 共 4 个月。
> 作为独立开发者持续工程活动的客观佐证。

---

## ⚠️ 安全策略

- 真实 API 密钥 / Token / 私钥 **绝不提交**
- `.env` / `secrets.*` 已通过 `.gitignore` 排除
- GitHub Secret Scanning + Push Protection 已启用
- 示例中的占位字符串(如 `mypassword` / `secret123`)**不是**真实凭据

---

## 📄 许可证

本仓库为个人项目,**未包含 LICENSE 文件**。
默认**仅可阅读**;如需再分发、修改或商用,请先通过 Issue 沟通。

---

## 🇯🇵 日本語 | 🇬🇧 English

- [日本語版](./README.md)
- [English version](./README.en.md)
