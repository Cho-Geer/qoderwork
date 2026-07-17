# P0-1：当前版本 runtime smoke 测试式样书

**文档 ID**: P0-1-RSM-20260717-01  
**状态**: `DESIGNED`  
**目标**: 设计并交接一次完整的 `create → start → bootstrap → execute(plan) → stop → cleanup` runtime smoke。本文件不是产品通过证明，所有用例状态均为 `DESIGNED`。

## 1. 输入边界、范围与未决项

### 1.1 唯一事实来源

| ID | 文档 | 采用行 | 用途 |
|---|---|---|---|
| SRC-01 | `logs/2026-07-16-隔离-serve-测试基建待办.md` | 5–7、15、18–22、26、35–37 | P0-1 固定生命周期、当前证据边界与失败升级禁令 |
| SRC-02 | `plans/隔离 serve 测试基建待办/01-bootstrap-child-grant-fail-closed实施步骤.md` | 9–20、33–54、159–176、180–185 | bootstrap 成功/失败契约和组件准入 |
| SRC-03 | `blueprints/blueprint-isolated-serve-test-infrastructure.md` | 5、26–39、87–151、316–346、350–360 | run 单元、隔离、生命周期、runtime/live 边界 |

不以仓库代码、历史 run、组件测试或其他文档补充业务事实；附件记录的组件与静态检查只能作为 runtime smoke 准入前置。

### 1.2 范围

单一、唯一 run 的：

1. `create` 生成 manifest、隔离 worktree、framework DB、OpenCode DB、日志/事件/PID/artefact 路径；
2. `start` 用真实 isolated-worktree `opencode serve` 启动 serve/SSE，并在 30 秒内 health 成功；
3. `bootstrap` 建立 root/child session 与生产 grant 绑定，使用 isolated framework DB 只读 oracle；
4. `execute(plan)` 只写 plan-only evidence / `NOT-RUN`，不发送 live prompt；
5. `stop` 与 `cleanup` 仅处理本 run，成功清理或保留明确失败现场。

### 1.3 非范围

- 双 run 隔离、SSE 归属与 serve 接管 reservation 的确定性集成（SRC-01:27；SRC-03:326–332）。
- TSI-05 runner manifest-only 迁移（SRC-01:28；SRC-03:287–292）。
- live LLM E2E、live prompt、`H2_AUTHORIZED=true`、`DRY_RUN=false`（SRC-01:30；SRC-02:20；SRC-03:341–346）。
- 完整 TypeScript 类型检查，或以本次结果关闭 runtime 以外的证据等级（SRC-01:33、35–37）。

### 1.4 准入、退出与 OPEN

- 准入：附件记录的定向 create/run-context/process 与完整 `scripts/test-serve/__tests__` 已完成；若执行时无法保持该前置，本 run 为 `BLOCKED`，不得开始生命周期（SRC-01:18–22；SRC-02:159–176）。
- 失败退出：任一阶段失败，保留实际 `BLOCKED` 或 `NOT-RUN` 状态与 artefact；不得升级状态（SRC-01:35–37）。


## 2. 原子需求、风险与独立 oracle

| REQ ID | 必需行为与可观察结果 | 风险 | 来源 | 覆盖 |
|---|---|---|---|---|
| REQ-RSM-01 | 固定完整生命周期在同一 run 留下 artefact。 | high | SRC-01:15、26；SRC-03:36 | RSM-001–007 |
| REQ-RSM-02 | create 使用 test-serve run 单元，manifest 记录 run ID、路径、端口、环境与状态。 | critical | SRC-03:87–129 | RSM-001 |
| REQ-RSM-03 | 真实 serve 在 30 秒内 health 成功，manifest `READY`。 | critical | SRC-03:130–139、334–337 | RSM-002 |
| REQ-RSM-04 | root session 出现在 isolated `OPENCODE_DB`。 | high | SRC-03:123–124、337 | RSM-003 |
| REQ-RSM-05 | hard gate 拒绝未 attest 的非 allowlist tool。 | critical | SRC-03:73、338 | RSM-004、ADV-01 |
| REQ-RSM-06 | 生产 `createGrant/bindGrant` 建立 root/child，DB oracle 与 manifest 一致。 | critical | SRC-02:11–18；SRC-03:141–151、339 | RSM-005、ADV-02 |
| REQ-RSM-07 | `execute(plan)` 无 live prompt，只写 plan-only / `NOT-RUN`。 | critical | SRC-01:30；SRC-03:21、151 | RSM-006、ADV-01 |
| REQ-RSM-08 | stop 只终止身份匹配的本 run PID；cleanup 仅在 stop 成功后。 | critical | SRC-01:12、14、26；SRC-03:137–139、359–360 | RSM-007、ADV-03 |
| REQ-RSM-09 | 本次不能写作 live LLM E2E。 | high | SRC-01:5–7、22、30、35–37 | RSM-006、007 |

| Oracle ID | 独立 oracle | 适用 REQ | 禁止替代物 |
|---|---|---|---|
| ORA-01 | 同一 run 的 manifest、目录、路径、环境、PID 记录。 | 01、02、03、08 | 固定路径或执行者自述。 |
| ORA-02 | 真实 serve 的 `GET /session` health 结果，30 秒内取得。 | 03 | 仅 PID 存在。 |
| ORA-03 | isolated `OPENCODE_DB` 的 root session 查询。 | 04 | 内存返回值或主 DB。 |
| ORA-04 | `skill-read-attest-required` 拒绝。 | 05 | 仅检查环境变量。 |
| ORA-05 | isolated framework DB 的只读 grant 查询与 manifest 字段交叉比对。 | 06 | direct SQL 创建/绑定或仅看 manifest。 |
| ORA-06 | plan artefact 加无 live prompt/executor 证据。 | 07、09 | H2 变量或模型回复。 |
| ORA-07 | PID 身份、最终 manifest 与 cleanup artefact/失败现场；cleanup 后 rootDir 存在、worktree 不存在、manifest/report/artifacts 可读。 | 08 | sleep 推测退出或删除现场。 |

## 3. 测试矩阵

| 测试 ID | 来源 | 前置条件 | 步骤 | 预期结果与 oracle | 失败语义 |
|---|---|---|---|---|---|
| RSM-001 `create` | REQ-RSM-01、02；SRC-01:26；SRC-03:87–129 | 准入成立；reviewer 提供可写 Git 元数据、commit、port、test ID；无 live 授权。 | 1. 创建唯一 run。2. 读取 manifest/run 目录。3. 收集 worktree、双 DB、logs、events、PIDs、artefacts 与环境。 | manifest 是控制面；列出的路径归属同一 run；双 DB 位于 run 目录。ORA-01。 | 任一 commit、port、overlay、路径或隔离条件失败：非零退出、`BLOCKED`，不得 start。 |
| RSM-002 `start` | REQ-RSM-03；SRC-03:130–139、334–337 | RSM-001 完成且非 `BLOCKED`。 | 1. start。2. 30 秒内 `GET /session`。3. 读取 manifest、PID、serve/SSE logs。 | health 成功；manifest `READY`；PID 与 run ID、预期二进制匹配。ORA-01、02。 | 超时或 PID 身份不符：保存日志、受控 stop、`BLOCKED`；不得 bootstrap。 |
| RSM-003 root SDK DB | REQ-RSM-04；SRC-03:123–124、337 | RSM-002 成功、manifest `READY`。 | 1. 创建 root session。2. 记录 root ID。3. 只读查询 manifest 指定 `OPENCODE_DB`。 | run 的 `OPENCODE_DB` 有 root ID。ORA-03。 | 无记录、记录在非 run DB 或查询失败：`BLOCKED`，保留 DB/日志。 |
| RSM-004 hard-gate 负向 | REQ-RSM-05；SRC-03:73、338 | RSM-002 成功；hard gate 开启；选择未 attest 非 allowlist tool。 | 1. 触发该 tool。2. 收集响应和 run logs。 | 被 `skill-read-attest-required` 拒绝。ORA-04。 | 未拒绝、错误不符或无法归属本 run：`BLOCKED`。 |
| RSM-005 production bootstrap | REQ-RSM-06；SRC-02:9–20；SRC-03:141–151、339 | RSM-002、003 成功；allowed paths 来自 manifest 且未越界。 | 1. 创建 root/child。2. 生产 `createGrant/bindGrant`。3. 只读查 framework DB。4. 比对 manifest。 | child `parentID`=root；grant `bound`；child ID 一致；仅 oracle 成功后 `BOOTSTRAPPED`/`bootstrapComplete=true`。ORA-05。 | 任一失败：`BLOCKED`、`bootstrapComplete=false`、CLI 非零；不得 runner 或写 `BOOTSTRAPPED`。 |
| RSM-006 `execute(plan)` | REQ-RSM-07、09；SRC-01:30；SRC-03:21、151、341–346 | RSM-005 成功；未提供 live 授权组合。 | 1. 执行 `execute(plan)`。2. 收集 plan artefact、manifest、SSE/log、执行记录。3. 查 live 痕迹。 | 只写 plan-only / `NOT-RUN`，无 live prompt。ORA-06。 | 有 live prompt/executor 痕迹或写作 live E2E：`BLOCKED`，保留证据。 |
| RSM-007 `stop → cleanup` | REQ-RSM-01、08、09；SRC-01:12、14、26、35–37；SRC-03:136–139、359–360 | RSM-006 结束，manifest、双 DB、SSE/log、PID、plan artefact 可读。 | 1. cleanup 前收集 artefact 清单。2. stop（SSE 后 serve）。3. 校验 PID/manifest。4. cleanup。5. 获取 cleanup artefact 或失败现场。 | 仅本 run 匹配 PID 被处理；cleanup 在 stop 成功后；成功有可交接 artefact，失败保留现场。ORA-01、07。 | PID 不符、未确认退出、cleanup 失败或无可读 artefact：`BLOCKED`，不清现场。 |

## 4. 对抗性测试章程

| ID | 目标风险 | 对抗步骤 | Kill condition | 来源 |
|---|---|---|---|---|
| ADV-01 | plan-only 越权发 live prompt 或将 runtime 写成 live。 | 无 live 授权执行 RSM-006，检查 plan artefact、SSE/log、执行记录。 | 任意 live prompt、executor 痕迹或 live LLM E2E 标注。 | SRC-01:30、35–37；SRC-03:151、341–346 |
| ADV-02 | bootstrap 把失败写成成功。 | 制造 grant 未绑定、child 非 root 或 DB oracle 不一致。 | `BOOTSTRAPPED`、`bootstrapComplete=true`、runner 继续或 CLI 零退出。 | SRC-02:15–20、46–54 |
| ADV-03 | stop/cleanup 误杀或伪造退出。 | PID 身份不匹配或不能确认退出时运行 RSM-007。 | 清 PID/PID 文件、写 `STOPPED`、删现场或终止非本 run 进程。 | SRC-01:12、14；SRC-03:137–139、359–360 |

## 5. 环境、隔离与执行交接

- 使用唯一 `run_id` 和唯一 manifest 控制面；只用 run 内 worktree、双 DB、logs、events、PIDs、artefacts（SRC-03:87–111）。
- 输入仅为 reviewer 显式提供的 commit、port、test ID；overlay 也必须由 reviewer 显式输入（SRC-03:115–129、165–180）。
- 禁止固定 4097、固定 `/tmp/sse-events.jsonl`、主 worktree、主 framework DB、全局 SDK DB；SQL 仅为只读 oracle（SRC-02:15、20；SRC-03:91–111）。
- 不并行运行会写 DB 的 runtime run；不设置、转发、伪造 `H2_AUTHORIZED=true`（SRC-01:37；SRC-02:20）。
- 执行顺序固定：`RSM-001 → RSM-002 → RSM-003 → RSM-004 → RSM-005 → RSM-006 → RSM-007`。任一步失败即停止后续步骤。
- 交接给 `test-specification-execution` 的最小证据：run ID、manifest、双 DB 查询、serve/SSE logs、events、PID 记录、hard-gate 拒绝、bootstrap DB oracle、plan artefact、stop/cleanup 结果以及 cleanup 后的 retained evidence 或失败现场。

## 6. 覆盖性质量门禁与文末自检

| 门禁项 | 结果 | 证据 |
|---|---|---|
| 原子需求数 | 9 | REQ-RSM-01 至 09 |
| 原子需求追溯覆盖 | 9/9 | 第 2 节覆盖列均非空 |
| 高/关键 happy 覆盖 | 8/8 | RSM-001 至 007 |
| 高/关键负向或边界覆盖 | 5/5 | RSM-004、006、007、ADV-01 至 03 |
| 高/关键对抗覆盖 | 4/4 | REQ-RSM-05 至 08 由 ADV-01 至 03 覆盖 |
| 缺失独立 oracle 的测试 | 0 | 每个 RSM 引用 ORA-01 至 07 |
| OPEN / BLOCKED 决策 | 0 / 0 | 无未决项 |

**质量门禁结论**: `DESIGNED`。已知范围均有测试和独立 oracle；cleanup evidence 留存契约已收口（组件验证 37/37 PASS），runtime smoke 仍为 `NOT-RUN`。

### 文末自检覆盖性

- [x] 业务事实仅来自三份指定附件。
- [x] 已明确 runtime smoke 范围与非范围，live LLM E2E 保持非范围。
- [x] 每个测试项包含来源、前置条件、步骤、预期结果、独立 oracle 和失败语义。
- [x] 已包含对抗章程、隔离计划、执行顺序与最小证据。
- [x] 未将任何产品行为写为已通过；测试状态仅为 `DESIGNED`，无未决项。
