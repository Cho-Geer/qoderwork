# CI collisions + quality gate remediation

**为什么**: 审核发现 work-one 有两组 workflow `concurrency.group` 冲突，且 PR CI 没有直接执行 code-quality / compliance 的批处理质量门；同时仓内还有一个备份残留和一个可低风险修复的 bare `catch`。

**改了什么**:
- `/home/zhaoge/workspace/opencode/work-one/.github/workflows/lint-test.yml`、`ci.yml`、`framework-ci.yml`、`quality-gate.yml` — 收敛/拆分并发组，新增独立 `Quality Gate` workflow，重命名 summary job，删除重复的 `lint-and-test.yml`
- `/home/zhaoge/workspace/opencode/work-one/.opencode/scripts/ci/run-quality-gates.ts`、`.opencode/service/file-guard/quality-batch.ts` — 新增 batch-safe 质量门包装脚本，并修正 `runFullScan()` 对当前框架仓目录结构的格式扫描假设
- `/home/zhaoge/workspace/opencode/work-one/.opencode/tools/resolve_domain_id.ts`、`.opencode/tools/safe_edit.ts.bak-pre-smoke2` — 把 bare `catch` 改成告警日志，删除备份残留
- `/home/zhaoge/workspace/qoderwork/team-elevation/*.md` — 复审后回写“已修 / 部分已修”状态

**决策**: 质量门没有直接去跑 MCP stdio server 外壳，而是复用 service-layer 的 `runFullScan()` + `checkGateCompliance()`；这样更适合 CI 的一次性批处理模型，也避免把交互式 transport 误当作 CLI 接口。
