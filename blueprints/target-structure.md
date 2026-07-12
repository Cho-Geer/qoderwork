# 目标框架目录结构 (2026-06-29 更新)

> 基于 MVC/MVVM 分层设计：Middleware(纯判断) → Service(所有写入) → DB(模型)
> Tool 瘦身为 Controller（参数解析 → 调 Service）
>
> **状态**: Phase 1-6 全部完成 ✅

```
.opencode/
│
├── plugins/                          ═══ Dispatcher 层（5 文件，路由 + 分发）═══
│   │
│   ├── before-dispatcher.ts         tool.execute.before → plugin-handlers/before/ 順次実行
│   ├── after-dispatcher.ts          tool.execute.after  → plugin-handlers/after/ 順次実行
│   ├── system-dispatcher.ts         experimental.chat.system.transform → plugin-handlers/system/
│   ├── session.ts                   chat.message / session.* → SessionService
│   ├── tool-def-trimmer.ts          tool.definition → schema 要約置換
│   │
│   │
├── plugin-handlers/                  ═══ Handler 层（30 文件，hook 実装）═══
│   │
│   ├── before/（14 文件）            ── tool.execute.before ハンドラ ──
│   │   ├── anti-bypass.ts           迂回防止 → 累積失敗チェック
│   │   ├── gate.ts                  合規ゲート → GateService.autoArmGateSession()
│   │   ├── checklist.ts             実行リスト門控 → GateService.validateChecklistBefore()
│   │   ├── codegraph.ts             CodeGraph impact → FileGuard.readImpactState/writeImpactState
│   │   ├── scope.ts                 Agent→ファイル作用域 → GateService.validateWriteScope()
│   │   ├── dispatch.ts              PLAN-FIRST 路由 → DispatchService.dispatchValidate()
│   │   ├── tdd.ts                   TDD 前置檢查 → TddService
│   │   ├── git-guard.ts             Git push/remote 阻断
│   │   ├── config-guard.ts          框架配置保護
│   │   ├── json-validate.ts         關鍵 JSON 語法判斷
│   │   ├── question-policy.ts       提問工具策略
│   │   ├── uc7ks.ts                 知識管線狀態判斷
│   │   ├── task.ts                  任務啟動標記 → DispatchService.markerConsume()
│   │   └── types.ts                 共有型定義
│   │
│   ├── after/（14 文件）             ── tool.execute.after ハンドラ ──
│   │   ├── scope.ts                 → FileGuard.trackDirtyModule
│   │   ├── audit.ts                 → FileGuard.recordWriteAudit
│   │   ├── cache.ts                 → KnowledgeService.syncCacheState
│   │   ├── gate.ts                  → GateService.drainStaleSessions
│   │   ├── dispatch.ts              → DispatchService.cleanup
│   │   ├── read-track.ts            → FileGuard.trackReadEvent
│   │   ├── uc7ks.ts                 → KnowledgeService.trackKnowledgeAfter
│   │   ├── tdd.ts                   → TddService (diff 検証)
│   │   ├── format.ts                → FileGuard (格式化触発)
│   │   ├── codegraph.ts             → FileGuard (codegraph 状態更新)
│   │   ├── task.ts                  → DispatchService.trackTaskComplete
│   │   ├── anti-bypass.ts           → 後処理観察
│   │   ├── db-health.ts             → lib/db-maintenance.runPluginHealthCheck()
│   │   └── types.ts                 共有型定義
│   │
│   ├── system/（1 文件）             ── system.transform ハンドラ ──
│   │   └── anti-bypass.ts           動的 system prompt 注入（2 段階）
│   │
│   └── shared/（1 文件）             ── 共有モジュール ──
│       └── config-loader.ts         plugin 設定読み込み
│
│
├── service/                          ═══ Service 层（12 子目录, 123 文件）═══
│   │
│   ├── file-guard/                   ── FileGuard：文件操作管线（23 文件）──
│   │   ├── index.ts                  统一入口 barrel
│   │   ├── lock.ts                   文件级锁（mutex）
│   │   ├── baseline.ts               TOCTOU 基线验证/更新
│   │   ├── backup.ts                 Git 级备份（.task_temp/.backups/ + DB 元数据）
│   │   ├── execute.ts                文件操作（writeSafe/safeDelete/safeMkdir/restore/generateDiff）
│   │   ├── shell-guard.ts            Shell 命令安全执行
│   │   ├── shell-config.ts           Shell 配置 + allowlist
│   │   ├── audit.ts                  审计记录（audit_log + write_audit_state）
│   │   ├── dirty-tracker.ts          eslint_state.dirty_modules 更新
│   │   ├── read-audit-write.ts       读审计写入
│   │   ├── read-audit-verify.ts      读审计验证
│   │   ├── tsc-gate.ts               TSC 门锁统一导出（re-export from tsc-gate-locks）
│   │   ├── tsc-gate-locks.ts         TSC 文件锁 + mutex（from lib/tsc-gate-db）
│   │   ├── tsc-diagnostic.ts         TSC 诊断运行（from lib/tsc-diagnostic）
│   │   ├── tsc-gate-config.ts        TSC 门禁配置读取（from lib/tsc-gate-config）
│   │   ├── critical-files.ts         关键文件保护规则（from lib/critical-files）
│   │   ├── codegraph-state.ts        CodeGraph impact 状态读写
│   │   ├── diagnostic-baseline.ts    TSC 诊断基线管理
│   │   ├── diagnostic-tracker.ts     TSC 诊断追踪器
│   │   └── query.ts                  只读查询接口
│   │
│   ├── gate/                         ── GateService：门禁状态机（28 文件）──
│   │   ├── index.ts                  统一入口 barrel
│   │   ├── state-machine.ts          7 状态 10 转换
│   │   ├── store-types.ts            类型定义（GateSession/GateStore 等）
│   │   ├── store-crud.ts             Store CRUD（load/save/reconcile）
│   │   ├── store.ts                  → re-export bridge (types + crud)
│   │   ├── checks.ts                 门禁检查函数
│   │   ├── enforcement.ts            强制模式解析
│   │   ├── session-mgmt.ts           创建 + arm session
│   │   ├── session-complete.ts       完成 + 验证交付物
│   │   ├── deliverables.ts           交付物模板 + 审批
│   │   ├── drain.ts                  过期 session 排空
│   │   ├── stale.ts                  过期阈值配置
│   │   ├── approval-context.ts       审批读取上下文
│   │   ├── checklist-phase.ts        清单阶段定义 + 类型
│   │   ├── checklist-lifecycle-crud.ts   清单 CRUD（create/mark/interrupt/reset）
│   │   ├── checklist-lifecycle-advance.ts 阶段推进
│   │   ├── checklist-lifecycle.ts    → re-export bridge (crud + advance)
│   │   ├── checklist-payload.ts      调度负载完整性
│   │   ├── checklist-query.ts        清单查询/摘要
│   │   ├── checklist-hooks.ts        工具→清单项连接（from lib/checklist-hooks）
│   │   ├── checklist-validate.ts     清单 before-hook 验证
│   │   ├── gate-validate.ts          gate before-hook 验证
│   │   ├── scope-validate.ts         scope before-hook 验证
│   │   ├── task-tracker.ts           任务完成追踪
│   │   ├── compactor-core.ts         状态压缩核心（from lib/state-compactor）
│   │   ├── compactor-schedule.ts     压缩调度（from lib/state-compactor）
│   │   ├── state-utils.ts            状态工具函数（from lib/state-utils）
│   │   └── query.ts                  只读查询接口
│   │
│   ├── dispatch/                     ── DispatchService：任务调度（16 文件）──
│   │   ├── index.ts                  统一入口 barrel
│   │   ├── router.ts                 L0-L4 路由验证逻辑
│   │   ├── route-validator-config.ts 路由配置读取 + 缓存（from lib/route-validator）
│   │   ├── route-validator-l0-l2.ts  L0-L2 验证（purpose/verb/scope）
│   │   ├── route-validator-l3-l4.ts  L3-L4 验证（permission/heuristic）
│   │   ├── tool-scope-match.ts       工具分类 + 路径匹配（from lib/tool-scope）
│   │   ├── tool-scope-paths.ts       路径解析 + dispatch allowlist
│   │   ├── queue.ts                  调度队列管理
│   │   ├── session-log.ts            session_log + dispatch_failed_log
│   │   ├── dag-policy.ts             DAG 策略 + auto_plan
│   │   ├── dag-version-manager.ts    DAG 版本管理（from lib/dag-version-manager）
│   │   ├── dispatch-validate.ts      dispatch before-hook 验证
│   │   ├── marker-consume.ts         任务启动标记消费
│   │   ├── cleanup.ts                清理过期 dispatch 条目
│   │   ├── auto-cleanup.ts           自动清理
│   │   └── query.ts                  只读查询接口
│   │
│   ├── tdd/                          ── TddService：TDD 状态管理（5 文件）──
│   │   ├── index.ts                  统一入口 barrel
│   │   ├── enforcement.ts            test_written 状态管理
│   │   ├── diff-verify.ts            diff 验证 + 浅测试检测（使用 git 级备份）
│   │   ├── test-report.ts            测试报告验证（from lib/safe-test-core）
│   │   └── query.ts                  只读查询接口
│   │
│   ├── knowledge/                    ── KnowledgeService：知识缓存（22 文件）──
│   │   ├── index.ts                  统一入口 barrel
│   │   ├── types-paths.ts            类型定义 + 路径工具
│   │   ├── manifest-db.ts            DB 读写（readManifestFromDb/upsertEntryInDb）
│   │   ├── manifest-materialize.ts    物化（DB → index.json）
│   │   ├── manifest.ts              → re-export bridge (db + materialize)
│   │   ├── search-add-read.ts        查询/统计（readManifest/searchManifest/getStats）
│   │   ├── search-add-write.ts       写入（writeManifest/addEntry）
│   │   ├── search-add.ts            → re-export bridge (read + write)
│   │   ├── cache-check.ts            缓存检查
│   │   ├── cache-search.ts           缓存搜索
│   │   ├── cache-attest.ts           缓存认证
│   │   ├── cache-sync.ts             缓存状态同步（cache-after hook 后端）
│   │   ├── enforcement.ts            写入许可检查
│   │   ├── pipeline-db.ts            UC7KS 管线 DB
│   │   ├── schema.ts                 知识 Schema
│   │   ├── audit.ts                  知识审计
│   │   ├── declare-scope.ts          模块作用域声明
│   │   ├── gap-report.ts             差距报告
│   │   ├── jobs.ts                   物化任务管理
│   │   ├── maintenance.ts            维护（janitor + 夜间压缩）
│   │   ├── prune-attest.ts           修剪 + 认证
│   │   └── after-track.ts            uc7ks-after hook 后端
│   │
│   ├── session/                      ── SessionService：session 生命周期（9 文件）──
│   │   ├── index.ts                  统一入口 barrel
│   │   ├── lifecycle.ts              9 步启动清理
│   │   ├── session-map.ts            session_map 管理
│   │   ├── resolver.ts               身份/域解析
│   │   ├── compliance-audit.ts       合规审计（gate-armed + knowledge-attested）
│   │   ├── dispatch-context.ts       调度上下文读写
│   │   ├── config-attest.ts          配置读取认证
│   │   ├── round-summary.ts          轮次摘要
│   │   └── query.ts                  只读查询接口
│   │
│   ├── permission/                   ── PermissionService：权限管理（3 文件）──
│   │   ├── index.ts                  统一入口 barrel
│   │   ├── reader.ts                 权限读取器（from lib/permission-reader）
│   │   └── isolation.ts              权限隔离核心（from lib/permission-isolation-core）
│   │
│   └── state/                        ── StateService：状态类型（2 文件）──
│       ├── index.ts                  统一入口 barrel
│       └── substate-types.ts         15 种子状态类型（from lib/substate-types）
│
│
├── tools/                            ═══ Controller 层（20 文件，瘦身后）═══
│   │
│   │  ── 安全工具（参数解析 → 调 Service）──
│   ├── safe_edit.ts                  → FileGuard.safeEdit/writeSafeFull + withInterruptGuard
│   ├── safe_shell.ts                 → FileGuard.safeBashTool + withInterruptGuard
│   ├── safe_delete.ts                → FileGuard.safeDelete + withInterruptGuard
│   ├── safe_restore.ts               → FileGuard.restoreBackup/getBackup + withInterruptGuard
│   ├── safe_mkdir.ts                 → FileGuard.safeMkdir + withInterruptGuard
│   ├── safe_test.ts                  → TddService.validateTestReport + withInterruptGuard
│   ├── safe_diff.ts                  → FileGuard.generateDiff + withInterruptGuard
│   ├── safe_hash.ts                  只读 node:crypto，无需 Service
│   │
│   │  ── 框架控制工具 ──
│   ├── dispatch_subagent.ts          → DispatchService
│   ├── checklist_status.ts           只读查询
│   ├── advance_checklist_phase.ts    → GateService.advanceChecklistPhase
│   ├── config_read_attest.ts         → SessionService
│   ├── knowledge_cache_attest.ts     → KnowledgeService
│   ├── knowledge_cache_search.ts     → KnowledgeService
│   ├── knowledge_gap_report.ts       → KnowledgeService
│   ├── module_scope_declare.ts       → KnowledgeService
│   ├── resolve_domain_id.ts          → SessionService + GateService.checklistWirePassed
│   ├── janitor.ts                    → KnowledgeService
│   ├── nightly-compaction.ts         → KnowledgeService/GateService
│   └── tsc-gate-reset.ts             → FileGuard.resetAllTscGateLocks
│
│
├── lib/                              ═══ 共享基础设施（49 文件）═══
│   │
│   │  ── INFRA：纯基础设施（15 文件，无业务逻辑）──
│   ├── db-manager.ts                 SQLite 单例，WAL 模式
│   ├── db-state-manager.ts           substate_kv 通用 CRUD
│   ├── db-maintenance.ts             DB 维护（VACUUM + 审计清理）
│   ├── hook-lifecycle.ts             withPluginLifecycle HOF
│   ├── interrupt-guard.ts            withInterruptGuard HOF
│   ├── log-manager.ts                运行日志
│   ├── log-rotator.ts                日志轮转
│   ├── tolerant-json.ts              容错 JSON 解析
│   ├── agent-identity.ts             Agent 身份常量 + 归一化
│   ├── agent-resolver.ts             Agent 身份解析
│   ├── state-manager.ts              STATE_PATHS + 状态接口
│   ├── state-cache.ts                状态缓存
│   ├── substate-manager.ts           子状态管理
│   ├── shared-infra.ts               共享基础设施
│   └── index.ts                      Barrel exports
│   │
│   │  ── BRIDGE：迁移桥接（34 文件，纯 re-export）──
│   │  # 每个桥接文件 5-20L，将旧 import 路径转发到 service/ 新位置
│   ├── safe-edit-core.ts             → service/file-guard/execute + lock + baseline
│   ├── safe-bash-core.ts             → service/file-guard/shell-guard + shell-config
│   ├── safe-test-core.ts             → service/tdd/test-report
│   ├── backup-manager.ts             → service/file-guard/backup
│   ├── gate-core.ts                  → service/gate/* (多模块)
│   ├── gate-checks.ts                → service/gate/checks
│   ├── gate-stale.ts                 → service/gate/stale
│   ├── checklist-hooks.ts            → service/gate/checklist-hooks
│   ├── critical-files.ts             → service/file-guard/critical-files
│   ├── state-utils.ts                → service/gate/state-utils
│   ├── state-compactor.ts            → service/gate/compactor-core + compactor-schedule
│   ├── dag-version-manager.ts        → service/dispatch/dag-version-manager
│   ├── dag-policy.ts                 → service/dispatch/dag-policy
│   ├── dispatch-db.ts                → service/dispatch/queue + session-log
│   ├── route-validator.ts            → service/dispatch/route-validator-{config,l0-l2,l3-l4}
│   ├── tool-scope.ts                 → service/dispatch/tool-scope-{match,paths}
│   ├── permission-reader.ts          → service/permission/reader
│   ├── permission-isolation-core.ts  → service/permission/isolation
│   ├── substate-types.ts             → service/state/substate-types
│   ├── tsc-gate-db.ts               → service/file-guard/tsc-gate-locks
│   ├── tsc-diagnostic.ts             → service/file-guard/tsc-diagnostic
│   ├── tsc-gate-config.ts            → service/file-guard/tsc-gate-config
│   ├── execution-checklist.ts        → service/gate/checklist-lifecycle
│   ├── knowledge-store.ts            → service/knowledge/manifest + search-add
│   ├── knowledge-audit.ts           → service/knowledge/audit
│   ├── uc7ks-schema.ts              → service/knowledge/schema
│   ├── uc7ks-utils.ts               → service/knowledge/cache-check + enforcement
│   ├── uc7ks-pipeline-db.ts         → service/knowledge/pipeline-db
│   ├── deliverables-templates.ts     → service/gate/deliverables
│   ├── approval-read-context.ts      → service/gate/approval-context
│   ├── read-audit.ts                 → service/file-guard/read-audit-write + read-audit-verify
│   ├── write-audit-lib.ts            → service/file-guard/audit
│   ├── audit-log.ts                  → service/file-guard/audit
│   └── baseline-diagnostic.ts        → service/file-guard/diagnostic-baseline
│
│
├── hooks/                            ═══ Pre-commit Hook（不变）═══
│   └── lib/
│       ├── hook-layers.ts            9 层验证链
│       ├── hook-commit-msg.ts        Commit message 验证
│       └── hook-critical-files.ts    关键文件检测
│
│
├── agents/                           ═══ Agent 定义（不变）═══
│   ├── orchestrator.md
│   ├── super-admin.md
│   ├── meta-planner.md
│   ├── architect.md
│   ├── coder-be.md
│   ├── coder-fe.md
│   ├── guardian.md
│   ├── arbiter.md
│   ├── ci-cd-agent.md
│   └── knowledge-curator.md
│
│
├── skills/                           ═══ Skill 定义（不变）═══
│   └── ...（16 active + 5 deprecated）
│
│
├── rules/                            ═══ 规则定义（不变）═══
│   ├── *.md                          7 个顶层规则
│   └── rule_detail/                  13 个子规则
│
│
└── scripts/                          ═══ 脚本（不变）═══
    └── *.ts                          维护脚本、验证脚本
```

## 文件统计

| 目录 | 文件数 | 状态 |
|------|--------|------|
| plugins/ | 5 | ✅ Dispatcher 层（路由 + 分发） |
| plugin-handlers/ | 30 | ✅ Handler 层（hook 実装） |
| service/ | 123 (12 子目录) | ✅ 全部 DB 写入唯一入口 |
| tools/ | 20 | ✅ 全部瘦 Controller（import from service/） |
| lib/ INFRA | 15 | ✅ 纯基础设施 |
| lib/ BRIDGE | 34 | ✅ 纯 re-export（5-20L/文件） |
| lib/ BUSINESS-REMAINING | 0 | ✅ 全部已迁移 |
| **总计** | **228** | |

## Service 子目录明细

| Service | 文件数 | 来源 |
|---------|--------|------|
| file-guard/ | 23 | 原始 Phase 1 + Batch 1 (TSC三部曲) + Batch 6 (critical-files) + anti-bypass 迁移 |
| gate/ | 28 | 原始 Phase 1 + Batch 4 (store/lifecycle 拆分) + Batch 6 (compactor/state-utils/checklist-hooks) |
| dispatch/ | 16 | 原始 Phase 1 + Batch 6 (route-validator 3拆/tool-scope 2拆/dag-version-manager) |
| knowledge/ | 22 | 原始 Phase 1 + Batch 4 (manifest/search-add 拆分) |
| session/ | 9 | 原始 Phase 1 + Batch 2 (compliance-audit) |
| tdd/ | 5 | 原始 Phase 1 + Batch 3 (test-report) |
| permission/ | 3 | Batch 6 新建 (from lib/permission-reader + isolation-core) |
| state/ | 2 | Batch 6 新建 (from lib/substate-types) |

## 调用关系

```
Agent（LLM）
  │ 唯一主动调用者
  ▼
Tool（Controller）──────── 只解析参数，调 Service
  │  import from "../service/xxx"
  │  withInterruptGuard from "../lib"（基础设施 HOF）
  ▼
Service（ViewModel）────── 所有 DB 写入的唯一入口
  │  ├── FileGuard     (文件管线, 23 文件)
  │  ├── GateService   (门禁, 28 文件)
  │  ├── DispatchService (调度, 16 文件)
  │  ├── TddService    (TDD, 5 文件)
  │  ├── KnowledgeService (知识, 22 文件)
  │  ├── SessionService (session, 9 文件)
  │  ├── PermissionService (权限, 3 文件)
  │  └── StateService  (状态类型, 2 文件)
  ▼
DB（Model）────────────── framework-state.db

Hook（Middleware）──────── 只读 DB → YES/NO 判断
  │  import from "../service/xxx"（调 Service 写入）
  │  判断逻辑 → throw/pass 表达
  ▼
零写入（判断结果通过 throw/pass 表达）
```

## 迁移历史

```
Phase 1 (2026-06-28): 建 Service 层 ✅
  6 子目录 54 文件, lib/ 桥接 379L (原 ~7500L)

Phase 3 (2026-06-28): Hook 纯化 ✅
  14 hook 纯化, ~3300L → ~300L (91%), 15 service 文件

Batch 1 (2026-06-29): TSC 三部曲迁入 service/file-guard/ ✅
  tsc-gate-db/diagnostic/config → 3 service + 3 bridge

Batch 2 (2026-06-29): Plugin 纯化 ✅
  5 plugin 导入从 lib/ 改为 service/

Batch 3 (2026-06-29): Tool 瘦身 ✅
  8 tool 导入从 lib/ 改为 service/ + test-report + checklist-hooks

Batch 4 (2026-06-29): 大文件拆分 ✅
  store(564→210+357), checklist-lifecycle(571→528+56),
  manifest(588→492+131), search-add(577→314+298)

Batch 5 (2026-06-29): 蓝图对齐 ✅
  knowledge/index.ts 添加 cache-sync 导出, 删除 session-crud.ts

Batch 6 (2026-06-29): lib/ 业务迁移 ✅
  9 文件迁移 + 3 拆分 + 2 新目录(permission/state)

Backup 统一 (2026-06-29): ✅
  diff-verify.ts 从文件级备份切换到 git 级备份 (修复隐藏 bug)
  safe-edit-core.ts 删除残留备份函数 → 纯桥接
```

## 约束

- **文件软限**: ≤400 行（超过需评估拆分必要性）
- **文件硬限**: ≤600 行（绝对不可超过）
- **Plugin 规则**: 零 DB 写入，零 lib/state-utils 导入
- **Tool 规则**: import from service/，withInterruptGuard from lib/
- **Bridge 规则**: 仅 re-export，无业务代码，目标 5-20L/文件
- **Service 规则**: 所有 DB 写入的唯一入口，index.ts 统一 barrel export
