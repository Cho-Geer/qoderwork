# qoderwork

> Personal AI Agent collaboration workspace / 个人 AI Agent 协作工作区 / 個人 AI エージェント連携ワークスペース

このリポジトリは、個人開発のための **AI Agent 連携ガバナンス・ワークスペース** です。
OpenCode フレームワークを基盤として、Plan-Audit アーカイバー、Agent オーケストレーション、Skill / Rules / Memory の運用を一元管理しています。

---

## 📌 これは何ですか

qoderwork は次のような目的で構成されています。

- **Plan-Audit Archiver**: タスクの設計 → 監査 → 振り返りを、書き換え不可なアーティファクトとして時系列に蓄積する
- **Agent Orchestration**: OpenCode / Codex / Qoder / Trae / WorkBuddy などの AI ツールを統一ルール下で運用する
- **Skill / Memory Governance**: Agent 用 Skill と Memory の整合性を定期的に監査する
- **Governance First**: 開発速度より**ガバナンスと検証**を優先する

つまり、**個人プロジェクト向けの "Plan-Audit-Code" の三層ワークスペース** です。

---

## 🏗 構成

| 領域 | 役割 | 主な内容 |
|---|---|---|
| `blueprints/` | 設計書 (Plan 層) | タスクの前段設計、依存関係、出口条件 |
| `audits/` | 監査ログ (Audit 層) | P0-2 / P0-3 / task-lens-m1 などの監査記録 |
| `documents/` | ドメイン文書 | 業務領域のドメイン知識、設計判断の記録 |
| `e2e-evidence/` | 実行証跡 | エージェント実行・検証のログ |
| `AGENTS.md` / `RULES.md` / `MEMORY.md` | セッション共通ルール | Agent 行動規範、判断基準、永続メモリ |
| `.codebuddy/` `.qoder/` `.trae/` `.workbuddy/` `.kimi-code/` `.codex/` `.codegraph/` | ツール連携設定 | 各 AI ツール固有のローカル設定 (ミラー) |

---

## 🔁 典型的なワークフロー

```
blueprints/
  └─ 新タスク定義
       ↓
audits/
  └─ 監査カード作成 (PHASE-NN)
       ↓
実装 + commit
       ↓
e2e-evidence/
  └─ 検証ログ保存
       ↓
MEMORY.md 更新
       ↓
次タスクへ
```

---

## ⚙️ 主な技術

- **TypeScript** (主言語)
- **Bun** (ランタイム)
- **OpenCode Framework** (Agent 基盤)
- **Conventional Commits** (commit 規約)
- **Worktree ベース開発** (`.worktrees/` は `.gitignore` 済)

---

## 📊 統計

> 過去 12 ヶ月の GitHub Contribution: 約 600 commits / 200 issues / 38 PRs
> 主に 2026-03 ～ 06 の 4 ヶ月に集中。
> 個人開発者としての継続的活動を客観的に示すデータです。

---

## ⚠️ セキュリティポリシー

- 実 API キー / トークン / 秘密鍵は **絶対にコミットしない**
- `.env` / `secrets.*` は `.gitignore` で除外
- GitHub Secret Scanning + Push Protection を有効化済
- 設定例 (`mypassword`, `secret123`) は **プレースホルダ文字列** であり実機では使用しない

---

## 📄 ライセンス

個人プロジェクトのため、明示的な LICENSE ファイルは含みません。
**閲覧のみ**可。再配布・改変・商用利用は事前連絡 (Issue) を必要とします。

---

## 🇬🇧 English | 🇨🇳 中文

- [English version](./README.en.md)
- [中文版本](./README.zh.md)
