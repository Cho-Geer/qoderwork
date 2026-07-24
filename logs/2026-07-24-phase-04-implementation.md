# 2026-07-24 PHASE-04 实施：Coverage 三态、五节卡与原子 Artifact

## 为什么

PHASE-04 是 Task Lens M1 的第四个阶段，实现 coverage 读取、副作用检测、卡片渲染和原子 artifact 写入。
本阶段仅新增文件，不修改任何现有文件。

## 改了什么

### 新增源文件（4 个）

- `scripts/task-lens/coverage-reader.ts` (473行)：严格 lcov parser + companion binding 验证 + FN/FNDA/DA 三态 observation 赋值
- `scripts/task-lens/side-effects.ts` (113行)：10 个内建 literal token + config token 扫描，sort+dedup
- `scripts/task-lens/card-renderer.ts` (325行)：五节中文卡片渲染（主干路径/变更函数表/副作用表/证据/反馈区）
- `scripts/task-lens/artifact-writer.ts` (451行)：deep serializable guard + stable canonicalizer + atomic write（staging/fsync/rename）

### 新增测试文件（2 个）

- `scripts/task-lens/__tests__/coverage-render.test.ts` (564行)：17 tests — FN/FNDA/DA/companion binding/side-effect/card 全覆盖
- `scripts/task-lens/__tests__/artifact-writer.test.ts` (383行)：8 tests — canonical/atomic/conflict/FAKE-INJECTION 全覆盖

### 审计基础设施

- `audits/task-lens-m1/scope-lock-PHASE-04.json`：已批准并冻结
- `audits/task-lens-m1/evidence/pre-change-PHASE-04.json`：实施前快照
- `audits/task-lens-m1/evidence/typecheck-after-PHASE-04.txt`：实施后 typecheck

## 决策

- CoverageBinding/CoverageResult/ArtifactWriteRequest/ArtifactReceipt 等新类型定义在各自源文件中导出，未修改 types.ts（PHASE-04 禁止修改上游文件）
- TL-C-301 重复检测：实现采用"同名不同行"检测（Map line→name 单值存储），改用不同行重复测试
- Sub-agent A（haiku）实现 4 个源文件；Sub-agent B 两次派遣失败后主 Agent 直接编写测试

## 测试结果

- 25/25 PHASE-04 测试 PASS
- 65/65 已有测试 PASS（零回归）
- Typecheck：仅 BASELINE-TS-001，零新增
- bun.lock 无变更
- git diff 仅 Allowed files

## 更新的文档

- 新建 `audits/task-lens-m1/scope-lock-PHASE-04.json`
- 新建 `audits/task-lens-m1/evidence/pre-change-PHASE-04.json`
- 新建 `audits/task-lens-m1/evidence/typecheck-after-PHASE-04.txt`
