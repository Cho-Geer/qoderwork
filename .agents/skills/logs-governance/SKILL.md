---
name: logs-governance
version: 1.0.0
description: "Logs index sync and archiving / 维护 logs/ 目录的索引与归档，优化用户查看与 LLM 读取效率。覆盖 logs/INDEX.md 生成与同步、按月归档旧日志到 logs/archive/、主题聚类。Trigger: logs 索引, logs 归档, logs index, logs archive, 日志太多, 日志归档, logs INDEX.md 同步, 日志整理. Not for: 写单个日志（按 AGENTS.md §11.1 命名）、documents/INDEX（用 doc-code-sync）、audits 归档（用 plan-audit-archiver）."
agent_created: true
---

# Logs Governance

## Language / 语言

Follow the user's language: reply in Chinese for Chinese requests and English for English requests. Provide both only when requested; preserve code, commands, paths, API names, identifiers, and quoted source text exactly.

维护 `logs/` 目录的索引与归档，解决日志数量膨胀（180+ 文件）导致的用户查看低效与 LLM 读取 token 浪费问题。复用 `doc-code-sync` 的 INDEX 维护模式，新增归档能力。

## 适用范围

**触发场景**：
- `logs/` 文件数量过多，需要生成或更新 `logs/INDEX.md`
- 需要按月归档旧日志到 `logs/archive/`
- session 启动时需要快速了解现有日志概况
- 用户要求"整理日志"、"日志太多"、"归档旧日志"

**不适用**：
- 写单个变更日志（直接按 AGENTS.md §11.1 命名规范 `YYYY-MM-DD-<主题>.md`）
- 维护 `documents/INDEX.md`（用 doc-code-sync）
- plan 审计归档（用 plan-audit-archiver）

## 关键路径

| 资源 | 路径 |
|------|------|
| logs 根目录 | `${QODERWORK_ROOT}/logs/` |
| logs 索引 | `${QODERWORK_ROOT}/logs/INDEX.md` |
| logs 归档 | `${QODERWORK_ROOT}/logs/archive/` |
| 索引模板 | `templates/logs-index-template.md` |

## 关键参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `ACTIVE_DAYS` | `14` | 近 N 天视为活跃日志，进"当前活跃"区段 |
| `ARCHIVE_DAYS` | `30` | 超过 N 天且无引用的日志可归档 |
| `DRIFT_TOLERANCE` | `2` | 行数漂移容忍度（±N 行不触发更新） |

## 工作流

本 skill 分两节：§A Index Sync（索引同步）与 §B Archive（归档）。两节可独立执行，但建议先 A 后 B。

---

## §A. Index Sync

复用 `doc-code-sync` 的 INDEX 维护模式，适配 logs 目录特性。

### Step A1: 收集日志元数据 `[ANALYSIS]`

列出 `logs/*.md`（排除 `INDEX.md`、`archive/` 子目录）。对每个文件收集：
- 文件名
- 行数（`wc -l`）
- 修改时间（`stat -c '%y'`）
- 主题词（从文件名提取，去掉 `YYYY-MM-DD-` 前缀和 `.md` 后缀）

```bash
cd ${QODERWORK_ROOT}/logs && for f in *.md; do
  [ "$f" = "INDEX.md" ] && continue
  lines=$(wc -l < "$f")
  mtime=$(stat -c '%y' "$f" | cut -d'.' -f1)
  topic=$(echo "$f" | sed 's/^[0-9-]*-//; s/\.md$//')
  echo "$f|$lines|$mtime|$topic"
done
```

### Step A2: 读当前 INDEX.md `[ANALYSIS]`

读 `logs/INDEX.md`（如不存在则视为首次创建）。解析：
- "当前活跃日志"表格
- "按主题聚类"区段
- "历史归档"区段

### Step A3: 检测变更 `[VERIFICATION]`

> **合理化检测**：如果你发现自己在想「只改了几个日志，INDEX 大概率不用更新」——停下来，这是跳步信号。必须实际比较文件列表和行数。

一条日志需要重新摘要 if 任一为真：
1. 新文件：在 `logs/` 但不在 INDEX
2. 比 INDEX.md 新：mtime > INDEX.md mtime
3. 行数漂移：实际行数与 INDEX 记录差超过 `DRIFT_TOLERANCE`

**零变更** → 停止，报告 "INDEX.md is up to date"，不修改。

`Verified-by: 实际 wc -l / find 输出对比`

### Step A4: 生成摘要 `[ANALYSIS]`

对每个新增/变更的日志：
1. 读全文
2. 生成一行中文摘要（≤50 字），格式：`<主题概述>。<关键结论/变更>`

### Step A5: 重写 INDEX.md `[OBSERVATION]`

用 `templates/logs-index-template.md` 结构重写。核心结构：

```markdown
# Logs 索引

> 本文件由 logs-governance skill 维护。新增日志后建议运行同步。
> **最近更新**: YYYY-MM-DD — <一句话说明>

## 当前活跃日志（近 14 天）

| 文件 | 主题 | 摘要 | 行数 |
|------|------|------|------|
| YYYY-MM-DD-xxx.md | <主题> | <摘要> | ~N |

## 按主题聚类

### <主题1>（N 个）
- YYYY-MM-DD-xxx.md — <一句话>
- ...

### <主题2>（N 个）
- ...

## 历史归档

见 `logs/archive/` 子目录：
- `logs/archive/2026-07/` — N 个日志
- ...
```

**聚类规则**：
- 从文件名提取主题词，相似主题归一类（如 "phase3-Nth-implementation-batch" 归 "Phase3 实施批次"）
- 每类列出文件，附一句话摘要
- 活跃日志同时出现在"当前活跃"和"按主题聚类"

### Step A6: 写入并报告 `[OBSERVATION]`

写入 `logs/INDEX.md`。报告：
- 新增文件数
- 更新文件数
- 未变文件数

---

## §B. Archive

按月归档旧日志到 `logs/archive/`。

### Step B1: 识别归档候选 `[ANALYSIS]`

扫描 `logs/*.md`（排除 INDEX.md），识别满足**全部**条件的候选：
1. mtime 超过 `ARCHIVE_DAYS`（默认 30 天）
2. 未被 `documents/INDEX.md` 引用
3. 未被任何 `plans/` 或 `audits/` 文件引用
4. 不在"当前活跃日志"区段

### Step B2: 引用检查 `[VERIFICATION]`

> **合理化检测**：如果你发现自己在想「这日志很旧了，肯定没人引用」——停下来，这是跳步信号。必须实际 grep 检查引用。

对每个候选，检查是否被引用：

```bash
# 检查 documents/INDEX.md
grep -l "<filename>" ${QODERWORK_ROOT}/documents/INDEX.md
# 检查 plans/
grep -rl "<filename>" ${QODERWORK_ROOT}/plans/ 2>/dev/null
# 检查 audits/
grep -rl "<filename>" ${QODERWORK_ROOT}/audits/ 2>/dev/null
```

`Verified-by: grep 输出 → 有/无引用`

**fail-closed 规则**：
- 任一引用检查命令失败 → 该日志标记 `[RISK] 无法确认`，**不归档**
- 不确定是否被引用 → **不归档**（保留原位）
- 被 `documents/INDEX.md` 引用 → **永不归档**

### Step B3: 执行归档 `[OBSERVATION]`

对确认无引用的候选：

1. 创建 `logs/archive/YYYY-MM/` 目录（按日志自身的月份，不是当前月份）
2. 移动日志：`mv logs/<file> logs/archive/YYYY-MM/`
3. 记录归档清单

**归档清单格式**（输出到 stdout 供用户确认）：
```
归档清单 (N 个):
- 2026-07-05-xxx.md → logs/archive/2026-07/
- 2026-07-06-yyy.md → logs/archive/2026-07/
跳过 (M 个，原因):
- 2026-07-08-zzz.md → 被 documents/INDEX.md 引用
- 2026-07-09-www.md → [RISK] 引用检查命令失败
```

### Step B4: 更新 INDEX.md `[OBSERVATION]`

归档后重新运行 §A 同步 INDEX.md，更新"历史归档"区段：
```markdown
## 历史归档

见 `logs/archive/` 子目录：
- `logs/archive/2026-07/` — N 个日志（归档于 YYYY-MM-DD）
```

---

## 与其他 skill 的配合

| 配合 skill | 角色 | 配合点 |
|-----------|------|--------|
| doc-code-sync | 标准来源 | INDEX 维护模式来源，logs-governance 复用并扩展 |
| plan-audit-archiver | 无 | 不配合（职责不重叠：logs vs audits） |
| pre-flight-enforcement | 约束 | 约束本 skill 的 A/B 节顺序执行 |

## 验证清单 `[VERIFICATION]`

> **合理化检测**：如果你发现自己在想「INDEX 写好了，归档也执行了，肯定没问题」——停下来，这是跳步信号。必须实际验证文件存在和移动结果。

执行完成后验证：

**§A 验证**：
- [ ] `logs/INDEX.md` 存在且含三个区段
  - `Verified-by: grep -c '## ' logs/INDEX.md -> >=3`
- [ ] 所有活跃日志已在 INDEX 中
  - `Verified-by: find logs -maxdepth 1 -name '*.md' ! -name INDEX.md -mtime -14 | wc -l 与 INDEX 表格行数对比`

**§B 验证**（如执行了归档）：
- [ ] 归档目录已创建
  - `Verified-by: ls -la logs/archive/YYYY-MM/ -> 目录存在`
- [ ] 归档文件已移动
  - `Verified-by: ls logs/archive/YYYY-MM/ | wc -l -> 数量匹配`
- [ ] 原位置文件已不存在
  - `Verified-by: ls logs/<archived-file> -> No such file`
- [ ] INDEX.md "历史归档"区段已更新
  - `Verified-by: grep 'logs/archive/' logs/INDEX.md -> 含归档记录`

## 常见陷阱

1. **误归档被引用日志**：`documents/INDEX.md` 或 `plans/` 可能引用旧日志作为证据。必须 grep 检查，fail-closed。
2. **归档目录用当前月份**：归档目录按日志自身的月份（文件名前缀），不是归档操作的当前月份。
3. **INDEX.md 自身被归档**：INDEX.md 永不归档，始终保留在 `logs/` 根。
4. **零变更仍重写 INDEX**：如 Step A3 检测零变更，不得重写 INDEX.md（避免无谓 git diff 噪音）。
5. **archive/ 子目录被当作日志扫描**：Step A1 的 `for f in *.md` 只扫根目录，不递归 archive/。但若用 find 需显式排除。
6. **覆盖历史归档记录**：每次归档追加到"历史归档"区段，不覆盖之前的归档记录。
