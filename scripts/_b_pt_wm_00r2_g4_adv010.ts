#!/usr/bin/env bun
/**
 * _b_pt_wm_00r2_g4_adv010.ts — Adversarial Charter ADV-PT-010 (identity confusion + order mutation)
 *
 * 创建于 2026-07-14 — 严格按 Blueprint v1.5.0 + test-spec v1.4.0 §5 编写
 *
 * Charter ID: ADV-PT-010
 * prerequisiteOrder: T-PT-048 → T-PT-049 → T-PT-050 (必须先证明 shared identity +
 *                   real DB lifecycle + authoritative active wiring)
 * FRAMEWORK_SKILL_READ_HARD_GATE=1 (由 reviewer 启动隔离 serve 后方可执行)
 * 状态: READY (not executed — H2 需用户授权)
 *
 * 覆盖 REQ/T:
 *   REQ-PT-017
 *   T-PT-048、049、050、051、052
 *
 * 技术（test-spec §5）:
 *   - 让 writer 改用 caller `task_id` (mutate_writer_trusts_task_id)
 *   - validator 改用独立 `resolveTaskId` (mutate_validator_independent_resolver)
 *   - 交换 active config 中 skill-policy/tool-governance 顺序 (mutate_order_swap)
 *   - 删除 root fallback (mutate_root_fallback_removed)
 *
 * Kill condition:
 *   - 任一 mutant 存活
 *   - root/child verified 正向仍被硬门拒绝
 *   - 未认证调用先进入 governance/executor
 *
 * Identity cases (5):
 *   - root_dispatch
 *   - child_safe_edit
 *   - cross_scope_replay
 *   - stale_state
 *   - unknown_tool
 *
 * Handler order contracts (6):
 *   - active config 中 6 对 before order 检查点
 *
 * 共享 lib 遵循清单:
 *   [x] §1.1 双保险: SSE JSONL + REST poll
 *   [x] §1.1 核心操作#5 主动 GET /question 轮询
 *   [x] §1.1 核心操作#6 POST /question/{QID}/reply 自动回复
 *   [x] §4.4 身份保留指导: prompt_async 必传 agent
 *   [x] §4.6 先查再发: prompt 前 GET 真实 agent
 *   [x] §4.5 Turn 模型: 按 session.idle/error 判定
 *   [x] §验证完成检查清单: 每步输出 "Verified-by:"
 *
 * 使用: bun run _b_pt_wm_00r2_g4_adv010.ts --run-dir <absolute-run-dir>
 *   所有环境参数从 run manifest 派生（port / SSE / worktree / artifacts）
 *   需 DRY_RUN=true (默认) 才不发起任何真 mutation
 */

// ── Hard guard ──
const DRY_RUN = process.env.DRY_RUN !== "false";
const RUN_DIR = requiredRunDir();
const RUN_MANIFEST = readRunManifest(RUN_DIR);
const SERVE_URL = `http://localhost:${RUN_MANIFEST.port}`;
const SSE_FILE = RUN_MANIFEST.paths.eventFilePath;
const WORKTREE_DIR = RUN_MANIFEST.paths.worktreeDir;

// [x] §2.2.7 Skill 读取硬门返工契约
// [x] §3.2.1 PT-WM-00R2 固定 Task Contract
if (!DRY_RUN && process.env.FRAMEWORK_SKILL_READ_HARD_GATE !== "1") {
  console.error(
    "FATAL: FRAMEWORK_SKILL_READ_HARD_GATE must be 1 (Blueprint §2.2.7) before disabling DRY_RUN",
  );
  process.exit(1);
}

import * as fs from "node:fs";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readRunManifest } from "./test-serve/run-context";
import {
  httpJson,
  getSessionAgent,
  promptAsync,
  waitForIdle,
  QUESTION_REPLY_DEFAULTS,
} from "./lib/serve-api-client";

// ── Test constants ──
const TEST_ID = "ADV-PT-010";
const EVIDENCE_DIR = RUN_MANIFEST.paths.artifactsDir;
const PREREQUISITES = ["T-PT-048", "T-PT-049", "T-PT-050"];
const FRAMEWORK_SKILL_READ_HARD_GATE = "1";

// ── Mutation type definition ──
interface Mutation {
  id: string;
  description: string;
  target: string;
  kill_condition: string;
}

// ── MUTATIONS 数组（4 项）──
const MUTATIONS: Mutation[] = [
  {
    id: "mutate_writer_trusts_task_id",
    description: "writer (skill-attest.ts:recordRead) 改用 caller 传入的 `task_id` 参数作为 canonical scope（不再调用 shared resolver）",
    target: ".opencode/skills/skill-attest.ts:recordRead() — 用 args.task_id 直接构造 task_scope_id",
    kill_condition:
      "writer 必须仍调用共享 resolveSkillAttestationIdentity(sessionID) 而非信任 caller task_id；ORA-PT-13: writer/validator 同一 resolver",
  },
  {
    id: "mutate_validator_independent_resolver",
    description: "validator 独立实现 resolveTaskId(sessionID) 而不复用 writer 的 resolveSkillAttestationIdentity",
    target: ".opencode/skills/skill-attest.ts:verifyRead() — 独立调用 resolveTaskId()",
    kill_condition:
      "validator 必须调用 shared resolveSkillAttestationIdentity，与 writer 同一 source；ORA-PT-13: 不存在第二套 resolver",
  },
  {
    id: "mutate_order_swap",
    description: "交换 .opencode/project.config.json.plugin_execution_order.before 中 skill-policy 与 tool-governance 的位置",
    target: ".opencode/project.config.json:plugin_execution_order.before — tool-governance 移到 skill-policy 前",
    kill_condition:
      "authoritative active config 与 runtime trace 均满足 `skill-policy < tool-governance`；ORA-PT-12/13: 拒绝停在 governance 前",
  },
  {
    id: "mutate_root_fallback_removed",
    description: "删除 root scope 兜底 (root session 应有 session:<sessionID> fallback)，child-only resolver 单独运行",
    target: ".opencode/skills/skill-attest.ts:resolveSkillAttestationIdentity() — 删去 root scope fallback 分支",
    kill_condition:
      "root Orchestrator session 仍能获得 session:<sessionID> 兜底；ORA-PT-13: root/child 正向可达",
  },
];

// ── Identity case type ──
interface IdentityCase {
  id: string;
  description: string;
  session: "root" | "child";
  expected_canonical_scope: string; // session:<sessionID> 或 task:<dag_task_id>
  tool_call: string;
  expected_disposition: "allow" | "deny-hard-block";
  oracle: string;
}

// ── IDENTITY_CASES 5 项 ──
const IDENTITY_CASES: IdentityCase[] = [
  {
    id: "root_dispatch",
    description: "root Orchestrator session 完整 attest 后调用 dispatch_subagent (root scope=session:<sessionID>)",
    session: "root",
    expected_canonical_scope: "session:<rootSessionID>",
    tool_call: "dispatch_subagent",
    expected_disposition: "allow",
    oracle: "ORA-PT-13: root 走 session:<sessionID>; writer/validator 同 resolver; child 被 dispatch 后获得独立 session",
  },
  {
    id: "child_safe_edit",
    description: "child session 完整 attest + 获得 allowed-path grant 后调用 safe_edit (child scope=task:<dag_task_id>)",
    session: "child",
    expected_canonical_scope: "task:<childDagTaskId>",
    tool_call: "safe_edit",
    expected_disposition: "allow",
    oracle: "ORA-PT-13: child 走 task:<dag_task_id>; writer/validator 同 resolver; allowed path grant 已消费",
  },
  {
    id: "cross_scope_replay",
    description: "把 child task:<dag_task_id> 的 state 重放到别的 session（跨 scope 复制）",
    session: "child",
    expected_canonical_scope: "task:<stolenDagTaskId>",
    tool_call: "safe_edit",
    expected_disposition: "deny-hard-block",
    oracle: "ORA-PT-13: cross-scope replay 被拒；ruleId=skill-read-attest-required",
  },
  {
    id: "stale_state",
    description: "valid attestation 后 required_list / file hash 改变，旧 state 不失效",
    session: "child",
    expected_canonical_scope: "task:<childDagTaskId>",
    tool_call: "safe_edit",
    expected_disposition: "deny-hard-block",
    oracle: "ORA-PT-11: 任何 state 字段变化使旧状态失效；file hash mismatch 拒绝",
  },
  {
    id: "unknown_tool",
    description: "已认证 session 调用未来未知工具 (e.g. 'unknown_tool_2099')",
    session: "child",
    expected_canonical_scope: "task:<childDagTaskId>",
    tool_call: "unknown_tool_2099",
    expected_disposition: "deny-hard-block",
    oracle: "ORA-PT-12: 未知工具由专用 rule 拒绝；executor entry=0",
  },
];

// ── Order contract type ──
interface OrderContract {
  id: string;
  description: string;
  before_chain_position: number; // 0-based index in active before chain
  required_relative_order: "before" | "after";
  target: string;
  failure_mode: string;
}

// ── ORDER_CONTRACTS 6 项 ──
const ORDER_CONTRACTS: OrderContract[] = [
  {
    id: "OC-1: skill-policy before tool-governance",
    description: "skill-policy 必须在 tool-governance 之前执行（authoritative active config + runtime trace 双证）",
    before_chain_position: 0,
    required_relative_order: "before",
    target: "skill-policy vs tool-governance",
    failure_mode: "若 swap：未认证写工具先进入 tool-governance 评估，可能误判 allow",
  },
  {
    id: "OC-2: skill-read-attest-required 在 skill-policy 抛",
    description: "skill-read-attest-required 抛出于 skill-policy handler 内（专用 hard_block）",
    before_chain_position: 0,
    required_relative_order: "before",
    target: "skill-policy.hardBlock() throw",
    failure_mode: "若不抛：异常被吞，未认证写工具进入 executor",
  },
  {
    id: "OC-3: tool-governance 在 skill-policy 之后",
    description: "tool-governance 在 skill-policy 之后（让 hard-block 先触发）",
    before_chain_position: 1,
    required_relative_order: "after",
    target: "tool-governance vs skill-policy",
    failure_mode: "若提前：未认证写工具绕过 skill-policy 评估",
  },
  {
    id: "OC-4: shell-policy 在 tool-governance 内",
    description: "shell-policy 必须由 tool-governance 调度（在 skill-policy 之后但在 executor 之前）",
    before_chain_position: 1,
    required_relative_order: "after",
    target: "shell-policy (sub-handler of tool-governance)",
    failure_mode: "若独立：绕开 tool-governance 的 unified call counter",
  },
  {
    id: "OC-5: repo-policy 在 tool-governance 内",
    description: "repo-policy 必须由 tool-governance 调度（read/write 分类统一）",
    before_chain_position: 1,
    required_relative_order: "after",
    target: "repo-policy (sub-handler of tool-governance)",
    failure_mode: "若独立：git/gh 写绕过 tool-governance 的 final guard",
  },
  {
    id: "OC-6: codegraph-enforce 在所有写工具前",
    description: "codegraph-enforce 必须在 safe_edit/safe_delete/safe_restore/safe_shell 4 个写工具前执行",
    before_chain_position: 0,
    required_relative_order: "before",
    target: "codegraph-enforce vs 4 write tools",
    failure_mode: "若延迟：CodeGraph 影响范围未被分析，写工具可直接 mutate",
  },
];

// ── Result types ──
interface IdentityCaseResult {
  caseId: string;
  expected: string;
  actual: string | null;
  pass: boolean;
  note: string;
}

interface OrderContractResult {
  contractId: string;
  expected: string;
  actual: string | null;
  pass: boolean;
  note: string;
}

interface Evidence {
  testId: string;
  timestamp: string;
  prerequisites: string[];
  frameworkSkillReadHardGate: string;
  dryRun: boolean;
  serveUrl: string;
  mutations: Mutation[];
  identityCases: IdentityCase[];
  identityResults: IdentityCaseResult[];
  orderContracts: OrderContract[];
  orderResults: OrderContractResult[];
  activeConfigDiff: { from: string; to: string };
  mutationScores: { mutationId: string; survived: boolean; rationale: string }[];
  summary: {
    totalMutations: number;
    totalIdentityCases: number;
    totalOrderContracts: number;
    pass: number;
    fail: number;
  };
  notes: string;
}

// ── log helpers ──
function log(m: string) { console.log(`[ADV-PT-010] ${m}`); }
function info(m: string) { console.log(`  ${m}`); }

// ── Stub mutation application (DRY_RUN) ──
async function applyMutationDryRun(mutation: Mutation): Promise<{ survived: boolean; rationale: string }> {
  log(`  [DRY-RUN] Would mutate: ${mutation.target}`);
  log(`  [DRY-RUN]   description: ${mutation.description}`);
  log(`  [DRY-RUN]   kill_condition: ${mutation.kill_condition}`);
  return {
    survived: false,
    rationale: "DRY_RUN=true: mutation 未应用；需 reviewer 接受临时 mutation + 24h revert 才执行真 mutation",
  };
}

// ── Stub identity case verification (DRY_RUN) ──
async function verifyIdentityCaseDryRun(c: IdentityCase): Promise<IdentityCaseResult> {
  log(`  [DRY-RUN] case=${c.id} session=${c.session} tool=${c.tool_call} expected=${c.expected_disposition}`);
  return {
    caseId: c.id,
    expected: c.expected_disposition,
    actual: "n/a-dry-run",
    pass: false,
    note: `DRY_RUN=true: 未真验证; production 需 reviewer 授权 + active session + shared resolver trace`,
  };
}

// ── Stub order contract verification (DRY_RUN) ──
async function verifyOrderContractDryRun(c: OrderContract): Promise<OrderContractResult> {
  log(`  [DRY-RUN] contract=${c.id} pos=${c.before_chain_position} rel=${c.required_relative_order}`);
  return {
    contractId: c.id,
    expected: c.required_relative_order,
    actual: "n/a-dry-run",
    pass: false,
    note: `DRY_RUN=true: 未真验证; production 需 reviewer 授权 + 读 active project.config.json + runtime handler trace`,
  };
}

// ── Main ──
async function main() {
  log("=== ADV-PT-010: identity confusion + order mutation ===");
  log(`serveUrl: ${SERVE_URL}`);
  log(`DRY_RUN: ${DRY_RUN}`);
  log(`FRAMEWORK_SKILL_READ_HARD_GATE: ${process.env.FRAMEWORK_SKILL_READ_HARD_GATE || "(not set)"}`);
  log(`prerequisiteOrder: ${PREREQUISITES.join(" → ")}`);
  log(`mutations: ${MUTATIONS.length}`);
  log(`identityCases: ${IDENTITY_CASES.length}`);
  log(`orderContracts: ${ORDER_CONTRACTS.length}`);
  log(`evidenceDir: ${EVIDENCE_DIR}`);

  // Step 0: prerequisites
  log("Step 0: 前置检查...");
  for (const prereq of PREREQUISITES) {
    log(`  prerequisite ${prereq} — 必须由 reviewer 单独执行 PASS 才可放行 ADV-PT-010`);
  }
  log(`  Verified-by: dry-run plan written → ${MUTATIONS.length} mutations + ${IDENTITY_CASES.length} identity cases + ${ORDER_CONTRACTS.length} order contracts`);

  // Ensure evidence dir
  if (!existsSync(EVIDENCE_DIR)) {
    mkdirSync(EVIDENCE_DIR, { recursive: true });
  }

  // Step 1: Health check (optional on dry-run)
  if (!DRY_RUN) {
    const healthRes = await httpJson("GET", "/session", SERVE_URL, undefined);
    if (healthRes.status !== 200) {
      log(`FATAL: serve not responding: ${healthRes.status}`);
      process.exit(1);
    }
    log(`  Verified-by: GET /session → ${healthRes.status}`);
  } else {
    log("  [DRY-RUN] skip GET /session");
  }

  // Step 2: Apply mutations (DRY-RUN)
  log("Step 1: Apply mutations (DRY-RUN)...");
  const mutationScores: { mutationId: string; survived: boolean; rationale: string }[] = [];
  for (const m of MUTATIONS) {
    const r = await applyMutationDryRun(m);
    mutationScores.push({ mutationId: m.id, survived: r.survived, rationale: r.rationale });
  }

  // Step 3: Verify identity cases
  log("Step 2: Verify 5 identity cases...");
  const identityResults: IdentityCaseResult[] = [];
  for (const c of IDENTITY_CASES) {
    const r = await verifyIdentityCaseDryRun(c);
    identityResults.push(r);
  }

  // Step 4: Verify order contracts
  log("Step 3: Verify 6 order contracts...");
  const orderResults: OrderContractResult[] = [];
  for (const c of ORDER_CONTRACTS) {
    const r = await verifyOrderContractDryRun(c);
    orderResults.push(r);
  }

  // Step 5: Active config diff stub (DRY-RUN)
  const activeConfigDiff = {
    from: "(DRY-RUN: no actual diff captured)",
    to: "n/a-dry-run",
  };

  // Step 6: Write evidence
  const evidence: Evidence = {
    testId: TEST_ID,
    timestamp: new Date().toISOString(),
    prerequisites: PREREQUISITES,
    frameworkSkillReadHardGate: process.env.FRAMEWORK_SKILL_READ_HARD_GATE || "(not set)",
    dryRun: DRY_RUN,
    serveUrl: SERVE_URL,
    mutations: MUTATIONS,
    identityCases: IDENTITY_CASES,
    identityResults,
    orderContracts: ORDER_CONTRACTS,
    orderResults,
    activeConfigDiff,
    mutationScores,
    summary: {
      totalMutations: MUTATIONS.length,
      totalIdentityCases: IDENTITY_CASES.length,
      totalOrderContracts: ORDER_CONTRACTS.length,
      pass: 0, // dry-run
      fail: 0,
    },
    notes: "DRY_RUN=true: this evidence is a prepared run-plan. To execute: reviewer must (1) start isolated serve with FRAMEWORK_SKILL_READ_HARD_GATE=1, (2) accept each mutation as 24h-revertible diff, (3) record shared resolver call graph + root/child DB lifecycle + active config before/after + handler order trace for 6 order contracts.",
  };
  const evidenceFile = join(EVIDENCE_DIR, "adv010-evidence.json");
  writeFileSync(evidenceFile, JSON.stringify(evidence, null, 2));
  log(`Evidence saved: ${evidenceFile}`);

  // Step 7: Write charter checklist
  const checklistFile = join(EVIDENCE_DIR, "adv010-checklist.md");
  writeFileSync(
    checklistFile,
    `# ADV-PT-010 charter checklist (DRY-RUN plan)

## Status
- ${TEST_ID}: READY (not executed)
- DRY_RUN: ${DRY_RUN}
- FRAMEWORK_SKILL_READ_HARD_GATE: ${process.env.FRAMEWORK_SKILL_READ_HARD_GATE || "(not set)"}

## Prerequisites
- ${PREREQUISITES.join("\n- ")}

## Mutations (4)
${MUTATIONS.map((m) => `- ${m.id}: ${m.description}`).join("\n")}

## Identity cases (5)
${IDENTITY_CASES.map((c) => `- ${c.id} [${c.session}]: ${c.tool_call} → ${c.expected_disposition} (scope=${c.expected_canonical_scope})`).join("\n")}

## Order contracts (6)
${ORDER_CONTRACTS.map((c) => `- ${c.id}: ${c.description}`).join("\n")}

## Required evidence (production run)
- mutation score (mutant survived / killed)
- active config diff (before/after .opencode/project.config.json)
- root/child DB lifecycle trace (writer/validator share resolver)
- handler order trace (skill-policy < tool-governance in runtime)
- 5 identity case results (root/child positive, cross-scope/stale/unknown all deny)
`,
  );
  log(`Checklist saved: ${checklistFile}`);

  log("\n=== Final ===");
  log(`  total mutations: ${MUTATIONS.length}`);
  log(`  total identity cases: ${IDENTITY_CASES.length}`);
  log(`  total order contracts: ${ORDER_CONTRACTS.length}`);
  log(`  status: READY (not executed — H2 需用户授权)`);
}

if (import.meta.main) main().catch((e) => { console.error("FATAL:", e); process.exit(1); });

function requiredRunDir(): string {
  const index = process.argv.indexOf("--run-dir");
  if (index < 0 || !process.argv[index + 1]) {
    throw new Error("run with --run-dir <absolute-path>");
  }
  return process.argv[index + 1];
}
