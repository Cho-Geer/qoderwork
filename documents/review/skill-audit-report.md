# Skill Audit Report — 2026-07-18

> 范围：`.agents/skills/`（项目级 skill，24 个）。本次为**诊断 + 优化方案确认**，未执行合并/替换/修复等修改性动作。
> 执行 skill：skill-diagnosis-optimization（目录参数适配为 `.agents/skills/`）；约束 skill：pre-flight-enforcement。

## 1. 诊断结果

### 1.1 总量评估

- 当前 skill 总数: **24**（最佳区间: 10-15，超出 9 个）
- description 总 token 开销: 8989 chars ≈ **~2700 tokens**
- `.merged-` 备份目录: 0；空目录: 0；`.bak` 残留: 0

### 1.2 各 skill 评分

| # | Skill | 描述长度 | 触发词 | 负面边界 | 双语 | 语言契约 | 正文行数 | 认知缺陷防护 | 总评 |
|---|-------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|---|
| 1 | blueprint-creation | ✅ 208 | ✅ | ✅ | ✅ | ✅ | 338 | ✅ 四项全 | 健康 |
| 2 | clean-sessions | ✅ 373 | ✅ | ✅ | ✅ | ✅ | 100 | ✅ | 健康 |
| 3 | computer-use-guidance-windows | ✅ 328 | ✅ | ✅ | ✅ | ✅ | 477 | ✅ | 健康 |
| 4 | create-skill | ✅ 311 | ✅ | ✅ | ✅ | ✅ | ⚠️ 574（近 600 上限） | ✅ | 健康（关注正文增长） |
| 5 | debug-environment-toolkit | ⚠️ 415 | ✅ | ✅ | ✅ | ✅ | 529 | ⚠️ 缺认知说明 | 需小修 |
| 6 | debug-subagent-tool-access | ✅ 360 | ✅ | ✅ | ✅ | ✅ | 240 | ✅ | 健康 |
| 7 | deterministic-implementation-planning | ❌ **636** | ✅ | ✅ | ✅ | ✅ | 319 | ⚠️ 缺认知说明 | **需修复** |
| 8 | doc-code-sync | ✅ 379 | ✅ | ✅ | ✅ | ✅ | 160 | ⏭️ 无 ANALYSIS→VERIFICATION 流程 | 健康 |
| 9 | docx | ✅ 364 | ✅ | ✅ | ✅ | ✅ | 55 | ⏭️ 纯操作型 | 健康 |
| 10 | find-skills | ✅ 325 | ✅ | ✅ | ✅ | ✅ | 433 | ✅ | 健康 |
| 11 | guided-code-editing | ✅ 367 | ✅ | ✅ | ✅ | ✅ | 193 | ✅ | 健康 |
| 12 | install-skill-dependency | ⚠️ 408 | ✅ | ✅ | ✅ | ✅ | 140 | ⏭️ | 健康 |
| 13 | isolated-serve-test | ✅ 272 | ✅ | ✅ | ✅ | ✅ | 162 | ⏭️ | 健康 |
| 14 | opencode-framework-dev | ⚠️ 460 | ✅ | ✅ | ✅ | ✅ | 318 | ✅ | 健康 |
| 15 | pdf | ✅ 302 | ✅ | ✅ | ✅ | ✅ | 321 | ⏭️ 纯操作型 | 健康 |
| 16 | plugin-creator | ⚠️ 401 | ✅ | ✅ | ✅ | ✅ | 48 | ⏭️ | 健康 |
| 17 | pptx | ✅ 290 | ✅ | ✅ | ✅ | ✅ | 163 | ✅ | 健康 |
| 18 | pre-flight-enforcement | ✅ 345 | ✅ | ✅ | ✅ | ✅ | 502 | ✅ | 健康 |
| 19 | qoderwork-guidance | ⚠️ 405 | ✅ | ✅ | ✅ | ✅ | 393 | ⏭️ 参考型 | 健康 |
| 20 | requirements-to-test-specification | ⚠️ 461 | ✅ | ✅ | ✅ | ✅ | 150 | ✅ | 健康 |
| 21 | serve-api | ⚠️ 462 | ✅ | ✅ | ✅ | ✅ | 42 | ⏭️ | 健康 |
| 22 | skill-diagnosis-optimization | ✅ 350 | ✅ | ✅ | ✅ | ✅ | 414 | ✅ | 健康 |
| 23 | test-specification-execution | ⚠️ 429 | ✅ | ✅ | ✅ | ✅ | 132 | ✅ | 健康 |
| 24 | xlsx | ✅ 338 | ✅ | ✅ | ✅ | ✅ | 235 | ✅ | 健康 |

说明：
- description 长度全部 ≥150，无过短；唯一 ❌ 过长是 deterministic-implementation-planning（636 chars > 500）。
- ⚠️ 400-500 区间共 6 个（debug-environment-toolkit 415、install-skill-dependency 408、opencode-framework-dev 460、plugin-creator 401、qoderwork-guidance 405、requirements-to-test-specification 461、serve-api 462 中为 7 个，均属"可接受"非"最佳"）。
- 认知缺陷防护四维（步骤标注/证据行/合理化检测/认知说明）：21 个 skill 含前三项；docx/pdf/qoderwork-guidance 无验证步骤属 ⏭️ 不适用；仅 debug-environment-toolkit 与 deterministic-implementation-planning 有 ANALYSIS→VERIFICATION 流程但缺认知说明（⚠️）。

### 1.3 重叠检测

两两 Jaccard 相似度（英文关键词 + 中文 bigram，阈值 0.3）：

- **pdf ↔ pptx = 0.32**（唯一 >0.3）。二者均为 Office 格式操作型 skill，相似源于 "Create, read, edit" 等同构句式，而非功能冗余——格式、脚本、工具链完全不同，**合并不合理**。
- pptx ↔ xlsx = 0.20；pdf ↔ xlsx = 0.19；create-skill ↔ find-skills = 0.18。均低于阈值。

**结论：当前 skill 体系冗余度低，无可合并组。**

## 2. 合并操作

未执行（诊断-only）。重叠检测证明无可合并组；虽然总数 24 > 15 上限，但按 skill 规则"直到达标或**无更多可合并组**"，合并路径已到终点。总量问题见第 5 节方案 D。

## 3. ACP 清理结果

未执行替换（诊断-only）。扫描全部 SKILL.md 与附属 reference 文件：

| 位置 | 匹配 | 处置结论 |
|------|------|---------|
| skill-diagnosis-optimization/SKILL.md | 21 处 | **保留**——本 skill 自身的扫描关键词与替换规则表，非残留 |
| serve-api SKILL.md / reference-operations.md | 2 处 | **保留**——"Not for: ACP bridge development" 负面边界，Step 11 明确允许 |
| acp_notify（serve-api references 等） | 12 处 | **保留**——OpenCode 真实事件类型名，非 bridge 引用 |
| 其余 22 个 skill | 0 | 无 ACP 残留 |

**活跃 skill 中 ACP 残留数 = 0，无需清理。**

## 4. 修复结果

| Skill 名称 | 问题 | 修复前 | 修复后 |
|-----------|------|--------|--------|
| deterministic-implementation-planning | description 过长 | 636 chars | **397 chars**（方案 A） |
| debug-environment-toolkit | description 400-500 区间 | 415 | **363**（方案 C） |
| install-skill-dependency | 同上 | 408 | **367**（方案 C） |
| opencode-framework-dev | 同上 | 460 | **396**（方案 C） |
| plugin-creator | 同上 | 401 | **392**（方案 C） |
| qoderwork-guidance | 同上 | 405 | **375**（方案 C） |
| requirements-to-test-specification | 同上 | 461 | **376**（方案 C） |
| serve-api | 同上 | 462 | **384**（方案 C） |
| test-specification-execution | 同上（初报漏列，实际共 8 个 ⚠️） | 429 | **394**（方案 C） |
| debug-environment-toolkit | 缺认知说明 | 无 | Step 3 `[VERIFICATION]` 标题下已插入（方案 B） |
| deterministic-implementation-planning | 缺认知说明 | 无 | Step 8 `[VERIFICATION]` 标题下已插入（方案 B） |

方案 A/B/C 已全部执行（2026-07-18）。验证：24 个 description 重提取全部落在 200-400 最佳区间，Trigger/Not for/中文四要素全部保留，总字符 8989 → 8356（≈2700 → ≈2506 tokens）。方案 D 未执行，待确认。

## 5. 优化方案（执行状态）

| 方案 | 内容 | 状态 |
|------|------|------|
| **A. 修复 description 过长** | deterministic-implementation-planning：636 → 397 | ✅ 已执行 |
| **B. 补认知说明** | debug-environment-toolkit、deterministic-implementation-planning 各插 1 段 | ✅ 已执行 |
| **C. 压缩 ⚠️ 区间 description** | 实际为 **8 个**（初报误写 6 个）400-500 chars → 全部压至 200-400 | ✅ 已执行 |
| **D. 总量 24>15 处置** | 建议 (a) 接受现状：无可合并组、单项描述均已精简、合并反损触发精度 | ⏳ 待确认 |

不做事项：无 .bak 清理、无空目录清理、无 ACP 替换、无合并。

## 6. 健康指标

| 指标 | 现状 | 目标 | 差距 |
|------|:---:|:---:|------|
| skill 总数 | 24 | 10-15 | 超 9（建议接受，见方案 D） |
| description 总 token | ~~2700~~ → **~2506** | - | ✅ 方案 A+C 已执行（8356 chars，全部在 200-400 最佳区间） |
| ACP 残留数 | 0 | 0 | ✅ |
| 空描述数 | 0 | 0 | ✅ |
| .bak 残留数 | 0 | 0 | ✅ |
| description 过短数 | 0 | 0 | ✅ |
| description 过长数 | ~~1~~ → **0** | 0 | ✅ 方案 A 已修复（2026-07-18） |
| 认知说明缺失数 | ~~2~~ → **0** | 0 | ✅ 方案 B 已修复（2026-07-18） |
| 缺触发词/负面边界/语言契约 | 0 | 0 | ✅ |
