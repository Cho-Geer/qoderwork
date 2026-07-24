# 2026-07-23 task-lens-m1 PHASE-02 implementation

## 为什么 / 改了什么
PHASE-02 在不构图/不写 artifact 前提下实现输入冻结、安全命令与差异提取，为 PHASE-03 提供确定性 receipt/diffModel 输入。新增 7 个 `scripts/task-lens/**` 文件：types.ts（纯类型）、command-runner.ts（runCommand 固定 argv/shell=false/env allowlist/timeout/byte-limit/AbortSignal+进程树终止）、config.ts（resolveConfig exact-key YAML/literal token/realpath 边界）、diff-extractor.ts（extractDiff+createInputReceipt canonical SHA-256 taskId）、cli.ts（parseCli+main，generate 返回 NOT_IMPLEMENTED_AFTER_INPUT）、两测试套件。package.json 仅加 `scripts.task-lens`；bun.lock 未动；无新增依赖。

## 关键决策
- Bun.spawn 用 cmds+options 重载匹配类型；rev-parse 不加 `--`（ref 为字面量/已校验 full SHA），diff/ls-files 保留 `--` 终止 option。
- TL-C-107 用 `maxStdoutBytes=4` 触发 TRUNCATED；canonical taskId 排除 generatedAt；coverage 恒 null（PHASE-04 接入）。

## 实测依据
- `bun test` 两套件：48 pass / 0 fail / 130 expect。
- typecheck delta 空（仅 BASELINE-TS-001 _b1_live.ts TS2307）。
- `git diff --check` 在 8 allowed 文件 EXIT=0；全仓 trailing-whitespace 仅来自预先 dirty 的 plans/opencode-framework-simplification-roadmap/*.md（非本 Phase 触碰）。
- bun.lock EXIT=0；`rg shell:true|execSync|NODE_OPTIONS|BASH_ENV|LD_PRELOAD scripts/task-lens` CLEAN。
- 真实 runCommand 在 TL-DIFF-WT/TL-CMD-ARGV all-pass 实际调用；fake 注入点均带 FAKE-INJECTION 注释。

## 更新了什么文档
本日志；audits/task-lens-m1/evidence/typecheck-after-PHASE-02.txt（新证据）。
