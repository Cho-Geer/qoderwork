# Blueprint: 审计治理证据与状态闭环 v3

**版本**: 3.2.0
**日期**: 2026-07-26
**状态**: AWAITING_EXTERNAL_HUMAN_APPROVAL
**优先级**: P0
**范围**: QoderWork 的 Plan 准入、审计边界、证据、发布与状态治理基建；不改 work-one 产品代码、数据库、serve 生命周期或 LLM 权限。

---

## 零、v3 边界与授权

v3 是独立、从零开始的治理链。任何 pre-v3 Plan、profile、豁免登记、receipt、审计报告或状态文本都不是 v3 输入：不得读取、迁移、适配、验证、引用或作为 v3 的授权、fixture、回归基线和兼容目标。

本 Blueprint 与其 canonical requirements contract 的外置、hash-bound 人类批准是后续 PLAN_SET 的唯一设计前置。批准前只允许创建本 Blueprint、canonical contract、批准请求与设计日志；禁止修改治理脚本或测试、创建 PLAN_SET、scope-lock、pre-change receipt、phase audit、report 或 `LATEST.md`。

本次批准只批准 v3 的设计合同，**不**宣称现有治理基建没有问题。批准前合同必须把全域资产审计、跨组件契约一致性和发现优先的失败语义写成后续实施的硬闸门；这些闸门通过前，任何“已同步”“无冲突”均为禁止结论。

v3.2.0 是对 v3.1.0 的受控设计修订：它补上首次建立 v3 准入器时的自举契约缺口。此前的批准决定保留为不可变历史事实，但不能绑定本修订；本修订必须获得新的精确 SHA-256 批准。Genesis Bootstrap Admission 不是 Plan provenance 值、不是兼容模式、不是 CLI/环境开关，也不是可由后续任务引用的常规流程。

## 一、问题背景

### 1.1 问题描述

当前治理基建把不同用途的文档放在同一 schema 名称下，并由多个脚本各自解释字段。Plan 准入、边界预检、receipt 生成、审计与发布因此不能共享一个可验证的合同。任何只为单一 Plan 增加 adapter 的修复都会再次制造隐式行为与旁路。

现有单组件测试即使全部通过，也不能证明模板、CLI、规则、Skill 和 consumer 对同一字段、枚举、错误码与状态语义有相同解释；因此“全部绿”不是“无契约错位”的证据。治理审计还必须完整保留已发现问题，不能以“暂未发现问题”取代覆盖范围、反例和可复现 finding。

### 1.2 已验证根因

1. Plan validator 的 requirements/case 字段形态与新规范需求的 `REQ-*`、对象化 fixture/oracle、正例/反例/不变量分类不一致。
2. 当前预检以 evidence directory 扫描作为通过证据来源；这不能表达精确 receipt 路径、嵌套路径边界、hash 与 REQ/DC 身份绑定。
3. 当前 receipt 生成器、receipt 模板、预检和审计 validator 对 fixture、decision case、执行结果与领域结果的字段要求不同。
4. 当前 active Plan 路径含可选 pre-v3 profile 输入；它会成为未来实施的可见旁路。
5. 当前活动链没有 version-controlled 的全域资产清单和引用边检查；活动文档、模板、脚本、测试和 Skill 可各自漂移而不被统一发现。
6. 当前测试主要验证各组件的局部行为，缺少同一 corpus 经所有 consumer 后的结果一致性与故意错位杀伤测试。

### 1.3 基线验证

在干净的 `audit-governance-v3` worktree（基线 `42d218fd7b73efa02e51c3da6993b6fe8011c4`）已执行：

| 命令 | 结果 | 结论 |
|---|---|---|
| `bun test ./.agents/skills/deterministic-implementation-planning/scripts/validate-plan.test.ts` | 24 pass / 0 fail | 现有 Plan validator 测试可运行，但不证明 v3 contract 已实现。 |
| `bun test ./.agents/skills/plan-audit-archiver/scripts/__tests__/audit-boundary-precheck.test.ts` | 2 pass / 0 fail | 现有预检测试可运行，但不证明 v3 的显式投影/receipt 链。 |
| 全部治理组件测试（10 files） | 129 pass / 0 fail | pre-v3 链当前可运行；其中含 pre-v3 bypass 与 `boundary-contract/v1` 受支持测试，不能作为 v3 准入证据。 |

**结论**：需要以一个可区分文档类别、由单一解析器实现的 v3 contract family 重建基建；测试绿灯不能替代该重建，也不能替代跨组件一致性与发现优先审计。

## 二、解决方案

### 2.1 方案对比

| 方案 | 做法 | 结论 |
|---|---|---|
| A：保留旧 profile 并加 adapter | 继续在 active validator 中解析旧结构 | 否决：形成未来旁路，且将 schema 分裂固化。 |
| B：按脚本逐个补字段 | 各脚本独立修改以通过某个 Plan | 否决：没有唯一事实源，后续仍会漂移。 |
| C：v3 schema family + 单一解析器 | 明确文档类别，由共享模块解析，所有消费者只调用该模块 | 选定。 |
| D：直接豁免全部 TODO 的准入 | 在未建立 v3 准入器时直接实施全部治理代码 | 否决：失去可审计的 pre-change 边界，不能再诚实声称 A–D 的实质性检查未降级。 |
| E：一次性 Genesis Bootstrap Admission | 仅为建立 v3 schema/parser 与 v3 Plan 准入器补充人类批准、冻结范围、前后双重验证 | 选定为 C 的初始化子阶段；完成即关闭，后续仍走 C 的常规 v3 gate。 |

### 2.2 v3 schema family

以下活动文档有唯一的 schema version 与 `document_kind`，禁止一个版本号代表多种结构：

| 文档 | schema_version | document_kind | 职责 |
|---|---|---|---|
| Canonical contract | `audit-governance/v3` | `canonical-requirements` | 人类批准的语义需求、REQ/DC、边界与证据下限。 |
| Approval request | `audit-governance-approval-request/v3` | `approval-request` | 请求人类对精确 Blueprint/canonical hash 作出批准或拒绝决定。 |
| Approval decision | `audit-governance-approval/v3` | `approval-decision` | 不可变的人类决定；修订后旧决定只读保留，不得绑定新 hash。 |
| Phase projection | `audit-phase-projection/v3` | `phase-projection` | 从 canonical contract 选择 REQ/DC，并绑定 canonical 与 scope-lock hash。 |
| Evidence receipt | `audit-evidence-receipt/v3` | `evidence-receipt` | 可信 runner 的执行与领域观察。 |
| Boundary matrix | `audit-boundary-matrix/v3` | `boundary-matrix` | 脚本的逐 DC 机械结论；只可为 `READY_FOR_LLM_REVIEW` 或 `BLOCKED`。 |
| Phase scope lock | `audit-scope-lock/v3` | `phase-scope-lock` | 单 phase 的 REQ/DC 选择、allowlist、freeze 和人类批准。 |
| PLAN_SET index | `audit-plan-set/v3` | `plan-set-index` | v3 phase 图、admission、completion 和 provenance 声明。 |
| Phase progression receipt | `audit-phase-progression/v3` | `phase-progression-receipt` | 依赖 phase 的可读、hash-bound 进度证明。 |
| Audit contract | `audit-governance-audit/v3` | `audit-contract` | matrix、MODEL_REVIEW、ledger、scope 与 verdict 的验证输入。 |
| Audit report | `audit-governance-report/v3` | `audit-report` | 不可变的审计叙事与 hash-bound audit contract。 |
| Latest pointer | `audit-governance-latest/v3` | `latest-pointer` | compare-and-swap 更新的当前不可变 report 指针。 |
| Surface manifest | `audit-governance-surface/v3` | `governance-surface-manifest` | 活动治理资产、hash、职责和允许引用的封闭清单。 |
| Conformance report | `audit-governance-conformance/v3` | `contract-conformance-report` | corpus、consumer agreement 和错位杀伤测试的不可变结果。 |
| Genesis bootstrap admission | `audit-governance-bootstrap/v3` | `genesis-bootstrap-admission` | 仅证明自举前置条件、范围与关闭条件；不构成 PLAN_SET 或 phase ACCEPT。 |
| Genesis bootstrap scope lock | `audit-governance-bootstrap/v3` | `genesis-bootstrap-scope-lock` | 自举唯一允许的文件、基线、命令、负例与人类批准。 |
| Genesis bootstrap receipt | `audit-governance-bootstrap/v3` | `genesis-bootstrap-receipt` | 自举前状态、执行结果、后置 v3 复核与关闭证明。 |

外置批准请求使用 `audit-governance-approval-request/v3`；批准决定使用 `audit-governance-approval/v3`，只绑定 immutable Blueprint 和 canonical contract 的路径与 SHA-256。批准状态绝不回写已哈希文档。

### 2.3 单一事实源与职责

新增 `scripts/lib/audit-governance-schema-v3.ts` 作为所有 v3 parser、type、path guard、hash verifier、identity checker 与 evidence-level comparator 的唯一实现。不得在 consumer 内复制 schema 判断。`provenance_level: v3-required` 是 v3 PLAN_SET 的唯一活动值；旧等级只可存在于隔离历史中，绝不可被 v3 consumer 接受。

| 主体 | 必须负责 | 禁止 |
|---|---|---|
| `validate-plan.ts` | 验证 v3 Plan 对 canonical contract、approval decision 与 REQ/DC phase mapping 的完整引用；验证 completion gate 语义 | 读取 pre-v3 Plan/profile；扫描证据；签发审计 verdict。 |
| receipt generator | 执行命令并原样记录执行结果、领域结果、error code、禁止副作用观察与 artifact hash | 接受手工成功/失败覆盖；省略 REQ/DC identity。 |
| boundary precheck | 只消费 projection 显式列出的 receipt，校验路径、hash、identity、oracle、fixture、领域结果与副作用 | directory discovery 作为验收证据；输出 ACCEPT。 |
| `prepare-audit` / `pre-check-evidence` | 从 projection 和明确 ledger 生成/验证 byte-exact audit 输入 | 静默跳过缺失或损坏 receipt。 |
| `validate-audit` | 校验 matrix、MODEL_REVIEW、evidence ceiling、scope 与所有 hash bind | 将 matrix BLOCKED 或 validator 非零解释为通过。 |
| `finalize-audit` | 创建不可变 report，并以 compare-and-swap 原子更新 hash-bound `LATEST.md` | 覆盖 report；失败时破坏旧指针。 |
| surface validator | 读取 manifest，报告全部未登记资产、非法引用、旧入口和 drift；持续扫描至完整 finding 集 | 在首个问题停止；把无扫描证据的“无问题”写为结论；读取隔离 Plan/profile 内容。 |
| conformance runner | 让同一 hash-bound corpus 经过每个 v3 consumer，比较规范化结果、状态、错误码与副作用 | 以 consumer 的私有 fixture 替代共同 corpus；由 parser 自己生成唯一 oracle。 |

### 2.4 全域资产与发现优先

`governance-surface-manifest` 必须逐项列出所有活动 rules、documents、Skills、scripts、templates、tests、CLI help 与 index/log interfaces，并为每项记录 path、sha256、owner、consumer、allowed references 和禁止引用。历史对象只以 path 和 `HISTORICAL/QUARANTINED` 分类出现；scanner 不读取其内容。

surface validator 必须执行完整扫描，而不是在第一个失败处返回。每个发现必须有 stable `finding_id`、classification、证据位置和可复现的失败原因；只有 manifest 覆盖完整、所有已声明检查实际运行、全部发现已关闭时，才允许报告 `NO_OPEN_FINDINGS`。这不是“什么问题没有”的默认结论。

### 2.5 跨组件契约一致性

canonical contract 必须包含 hash-bound conformance corpus：每个 schema pair、字段、枚举、错误码、状态转换与禁止副作用至少有一个合法样本和一个单字段变异样本。该 corpus 是独立 oracle，不由 shared parser 生成。

每个 v3 consumer 必须处理同一 corpus，并输出可比较的规范化结果。conformance runner 比较接受/拒绝结果、error code、状态、禁止副作用和输出 hash；任一差异为 BLOCKING finding。另需故意制造 `document_kind`、error code、dual observation、orphan receipt、consumer-local parser 与 CAS 语义的错位，以证明该门本身能失败。

### 2.6 证据语义

每个 v3 receipt 必须同时保存：

1. `execution.observed`：`PASS` 或 `FAIL`，且与真实 `exit_code` 一致；
2. `domain_observation.result`：与该 DC 的 `expected.result` 精确比较；
3. `domain_observation.error_code` 与 `forbidden_side_effects_observed`；
4. `requirement_id`、`decision_case_id`、`fixture_id`、`oracle_id`、evidence level、artifact hash 与 repository-state hash。

这避免把“测试命令成功”误写成“领域状态 READY/PUBLISHED”，也避免用非零退出代替对预期错误和禁止副作用的验证。

### 2.7 无旧输入原则

v3 的 active template、CLI、帮助信息、测试夹具、文档索引和 Plan 不得出现 pre-v3 profile 或 pre-v3 Plan path。任何不声明 v3 schema family 的 Plan 一律不是 v3 输入，且没有兼容或迁移模式。

### 2.8 Genesis Bootstrap Admission：不降低检查的初始化合同

当前 `validate-plan.ts` 拒绝 `audit-governance/v3`，而 v3.1.0 又要求 PLAN_SET 先通过该准入器，形成可复现的自举循环。Genesis Bootstrap Admission 只补齐“先建立准入器”的初始化语义；它不宣布当前实现合规，也不把任何常规 phase 的检查移除或放宽。

| 控制点 | Genesis 要求 | 关闭后的常规要求 |
|---|---|---|
| 触发 | 隔离最小 v3 输入被当前准入器拒绝，且错误和输入 hash 被保留 | v3 PLAN_SET 必须由 v3 准入器验证。 |
| 输入 | 本 Blueprint/canonical 的新批准、基线 commit、只含 v3 的 bootstrap admission/scope lock/pre-change capture | canonical、PLAN_SET、phase scope-lock、projection 与 receipt。 |
| 人类门 | 对精确 bootstrap scope-lock 的路径和 SHA-256 单独批准 | 对每个 phase 的 scope-lock 单独批准。 |
| 写入范围 | 仅建立 shared v3 schema/parser、v3 Plan admission、必要模板和测试；精确文件列表由 bootstrap scope-lock 冻结 | 仅该 phase 的 allowlist。 |
| 机械检查 | 固定正例、单变量负例、旧输入拒绝、allowlist、hash、shared-parser 调用边和新准入器自检 | phase fixed commands、caller tests、matrix 与 audit validators。 |
| 关闭 | 新 v3 准入器必须后验解析并验证 bootstrap artifacts，随后验证新的正式 v3 PLAN_SET；否则 BLOCKED | P-02/P-02A、P-03 至 P-07 与全链 gates。 |

Genesis 的唯一状态迁移是 `DRAFT → HUMAN_APPROVED → IMPLEMENTING → POSTHOC_V3_VALIDATED → CLOSED`，任一失败转为 `BLOCKED`。`CLOSED` 不是 ACCEPT，不产生 report 或 `LATEST.md`，也不能被任何后续 Plan 作为批准、豁免或兼容输入。一个 canonical revision 只允许一个 genesis admission；新 canonical revision 若再遇到同类问题，必须重新设计、重新冻结并重新获得人类批准。

## 三、实施清单

### 3.1 预期文件变更

| 阶段 | 允许文件 | 目标 |
|---|---|---|
| 0 | 本 Blueprint、canonical contract、approval request、logs | 人类批准的 v3.2 设计基线；既有批准决定只读保留。 |
| G | 仅未来 bootstrap scope-lock 精确列出的 schema/parser、Plan admission、模板及测试文件 | 建立 v3 准入器；不得创建常规 PLAN_SET、phase audit、report 或 `LATEST.md`。 |
| 1 | `scripts/lib/audit-governance-schema-v3.ts`、surface manifest/validator、conformance corpus/runner 与对应测试 | 单一 schema/parser、全域发现和独立共同 oracle。 |
| 2 | `validate-plan.ts`、phase progression、其模板/测试、旧豁免登记 | v3-only Plan 准入、`v3-required` 与 completion gate。 |
| 3 | scope/projection schema、receipt generator、receipt template、boundary precheck、precheck tests | 显式 projection/receipt 机械矩阵与 dual observation。 |
| 4 | `prepare-audit.ts`、`pre-check-evidence.ts`、`validate-audit.ts`、模板/测试 | v3 audit hash 链、MODEL_REVIEW、finding continuity 与 evidence ceiling。 |
| 5 | `finalize-audit.ts`、发布测试、活动规则/Skill/文档索引、logs/index | 不可变 report、原子指针和活动资产同步。 |

### 3.2 受控顺序

1. 人类批准 v3.2 Blueprint 与 canonical contract 的精确 SHA-256；既有 v3.1 approval decision 不得被改写或复用。
2. 仅当保留的最小 v3 probe 证明当前准入器不支持 v3 时，创建 bootstrap admission、bootstrap scope-lock 与 pre-change capture；人类批准该 scope-lock 的精确 SHA-256 后，才可进入 Stage G。
3. Stage G 仅建立 v3 schema/parser 与 v3 Plan admission。其关闭前必须用新准入器验证 bootstrap artifacts，并验证一个新的正式 v3 PLAN_SET；失败时停止，不产生 phase ACCEPT、report 或 `LATEST.md`。
4. 仅在 Stage G `CLOSED` 后，创建并批准正式 v3 PLAN_SET；其首个可执行 phase 必须先实现 surface/conformance 基建，其余 phase 只采用本 Blueprint 的 allowed file sets。
5. 每个常规代码 phase 在写入前单独完成 P-02/P-02A scope-lock、human approval 与 pre-change receipt。
6. 仅在前序 phase 有有效 ACCEPT admission 后进入下一常规 phase。
7. Phase 5 完成全链 file-integration 回归与最终 v3 audit；不宣称 runtime-smoke 或 live-LLM-E2E。

## 四、验证计划

### 4.0 Genesis Bootstrap Admission

- [ ] 保存一个只含 v3 schema 的最小 probe；当前准入器必须以可复现非零结果拒绝它，且不得读取任何 pre-v3 输入。
- [ ] bootstrap scope-lock 必须绑定 v3.2 Blueprint/canonical、基线 commit、精确 allowlist、固定正例/负例、CodeGraph 调用边和人类批准。
- [ ] bootstrap 结束后，新 v3 parser/validator 必须验证 admission、scope-lock 和 pre-change capture 的 schema、hash、路径与状态顺序；后验失败即 BLOCKED。
- [ ] 新准入器必须接受新的正式 v3 PLAN_SET，并拒绝 non-v3 schema、pre-v3 输入、缺失批准、hash 漂移、consumer-local parser 与第二次 genesis 尝试。
- [ ] bootstrap 不产生 phase ACCEPT、audit report 或 `LATEST.md`；任何此类副作用均为失败。

### 4.1 单元测试

- [ ] 每类 v3 document 的 parser 接受唯一合法形态，并拒绝错误 `document_kind`。
- [ ] Plan validator 拒绝缺少 v3 approval、canonical hash 或 REQ/DC mapping 的 index。
- [ ] receipt generator 的 execution 与 domain observation 分别被验证。
- [ ] precheck 拒绝 path escape、symlink escape、receipt hash/identity/fixture/oracle 漂移、`NOT_FOUND`、`UNAVAILABLE`、重复或未选择 DC。
- [ ] matrix BLOCKED、hash drift、MODEL_REVIEW 缺失、evidence ceiling 不足与 validator 非零均拒绝发布。

### 4.3 全域与跨组件契约验证

- [ ] surface manifest 缺项、重复项、hash 漂移、未登记活动资产、非法引用和活动旧入口均形成可复现 finding；scanner 在首个 finding 后仍完成全量扫描。
- [ ] 所有活动 templates 对应的样本经 shared parser round-trip 后得到唯一 document type 与规范化 hash。
- [ ] 同一 conformance corpus 经每个 consumer 后的接受/拒绝、状态、error code、禁止副作用和输出 hash 一致。
- [ ] 故意制造错位的 `document_kind`、error code、execution/domain observation、orphan receipt、consumer-local parser 与 CAS conflict 均使 conformance gate 失败。
- [ ] 明确断言旧隔离路径未被读取；只检查其路径不被活动边引用。

### 4.2 文件级集成测试

- [ ] 合法 canonical→scope-lock→projection→receipt→matrix→audit→LATEST 链得到唯一可发布结果。
- [ ] evidence directory 中 orphan receipt 只产生 warning，不能覆盖或补足 projection 的 receipt。
- [ ] 两个 publisher 竞争时仅一个不可变 report 与一个合法指针状态可见。
- [ ] render、hash、compare-and-swap 任一步失败时，旧 `LATEST.md` 字节不变且失败现场保留。

### 4.4 子系统合规验证

| 子系统 | 状态 | v3 验证 |
|---|---|---|
| Concurrency Safe | ⚠️ | report 独占创建、pointer CAS、失败保留测试。 |
| Hardened Enforcement | ✅ | 机械 matrix/validator 不能被模型文本豁免。 |
| Central State Management | ✅ | canonical/projection/matrix/ledger 均有单一 hash-bound 事实源。 |
| Multi-Agent | ⚠️ | schema、scope、publication 串行且有竞争测试。 |
| Templatization & Parameterization | ✅ | 共享 parser 驱动所有模板与 consumer。 |
| TypeScript + Bun Runtime | ✅ | 无新依赖，新增逻辑具 Bun tests。 |

其余系统不受影响：不改 work-one、DB、serve、权限或 live LLM 流程。

## 五、风险与回滚

| 风险 | 缓解 |
|---|---|
| 又出现 schema 分支 | 所有 consumer 强制调用共享 parser；测试禁止 consumer 私有解析。 |
| 新 Plan 绕过批准 | Plan validator 验证外置 approval record 与 exact hashes。 |
| 证据目录污染 | 只有 projection/ledger 的显式 path 可作为证据。 |
| 发布中断 | immutable report、CAS pointer、失败保留旧指针和候选。 |
| 局部测试全绿但组件语义错位 | hash-bound corpus、consumer agreement、错位杀伤测试和独立 oracle。 |
| 发现被首个失败遮蔽或被“无问题”叙述覆盖 | 全域 manifest、完整 finding 集、stable finding ID 和扫描完成性门。 |
| 自举被扩展为常规旁路 | 单一 admission ID、一次性状态机、无 CLI/环境开关、scope-lock 精确 allowlist、后验 v3 验证和第二次尝试负例。 |
| 自举削弱 A–D 检查 | pre-change capture、人工批准、固定正负例、独立审计、正式 PLAN_SET 再准入；任何缺失均不允许关闭。 |

实施前若 v3 文档未获批准，回滚动作是停止，不创建任何代码或 provenance。实施后每一 phase 仅回滚该 phase 的 allowlist 内代码；不删除证据、不覆盖 report、不改写批准文档。

## 六、成功标准

- [ ] v3 Blueprint 与 canonical contract 获得外置 hash-bound 人类批准。
- [ ] 若使用 Genesis Bootstrap Admission，它只完成一次、无常规旁路，并在关闭前经新 v3 parser/validator 后验验证；新的正式 v3 PLAN_SET 随后通过 v3 准入。
- [ ] active 链路中没有 pre-v3 profile、兼容分支或 pre-v3 Plan 输入。
- [ ] v3 的全部活动文档类型、状态和 provenance 值均有唯一 schema pair 与唯一 owner；没有未定义的隐式结构。
- [ ] surface manifest 覆盖全部活动治理资产；发现优先扫描保留完整 finding 集，且任何 `NO_OPEN_FINDINGS` 均有覆盖与反例证据。
- [ ] conformance corpus、consumer agreement、模板 round-trip、错位杀伤测试和静态 shared-parser 架构检查均通过。
- [ ] 所有 schema consumer 使用同一 parser，并有 v3-only 测试覆盖。
- [ ] 每个 v3 phase 在写入前满足 P-02/P-02A，在状态推进前满足 P-03 至 P-07。
- [ ] matrix 的唯一正向状态是 `READY_FOR_LLM_REVIEW`；最终 ACCEPT 仍要求 MODEL_REVIEW 与 `validate-audit.ts` exit 0。
- [ ] report 与 `LATEST.md` 只经验证后的不可变/原子发布路径产生。

## 七、参考

- `handoff/2026-07-26-audit-boundary-and-plan-contract.md`（方法论与职责边界）
- `.agents/skills/plan-audit-archiver/provenance-rules.md`（P-01 至 P-07）
- `AGENTS.md`（工作区强制流程）
