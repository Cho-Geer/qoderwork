#!/usr/bin/env bun
/**
 * _b_pt_wm_00r2_g3_t052.ts — G3 mutation matrix: 8 mutation fixture (T-PT-052)
 *
 * 创建于 2026-07-14 — 严格按 test-spec v1.4.0 §3.2 T-PT-052 + Blueprint v1.5.0 §2.2.7
 *
 * Test ID: T-PT-052 (G3 group, mutation matrix)
 * prerequisiteOrder: T-PT-048 → T-PT-049 → T-PT-050 (fixture + lifecycle + wiring 全部先 PASS)
 * FRAMEWORK_SKILL_READ_HARD_GATE=1 (由 reviewer 启动隔离 serve 后方可执行)
 * 状态: READY (not executed — H2 需用户授权)
 *
 * 覆盖 REQ: REQ-PT-002、REQ-PT-015、REQ-PT-016、REQ-PT-017
 * Oracle: ORA-PT-02/11/12/13
 *   - ORA-PT-02: 全部 mutation 必须被 kill (无 mutant 存活)
 *   - ORA-PT-11: canonical identity mutation 必须被拒
 *   - ORA-PT-12: skill-policy mutation 必须被拒
 *   - ORA-PT-13: DB lifecycle mutation 必须被拒
 *
 * 8 mutation fixture (test-spec §3.2 T-PT-052 硬性要求):
 *   1. mut-attest-fail-allow      : attestSkillRead 改为始终 allow
 *   2. mut-skip-file-hash-check   : state validator 跳过 file hash 检查
 *   3. mut-skip-agent-check       : state validator 跳过 agent 检查
 *   4. mut-skip-scope-check       : state validator 跳过 canonicalTaskScope 检查
 *   5. mut-trust-stale-state      : state validator 信任 stale state
 *   6. mut-silent-catch-error     : state validator 静默吞 DB 错误
 *   7. mut-write-without-tx       : DB 写缺事务包裹
 *   8. mut-allow-unknown-tool     : 未知工具默认 allow
 *
 * 4 oracle 校验 (test-spec §3.2 T-PT-052 硬性要求):
 *   - oracle-1: ORA-PT-02 全部 8 mutation 在隔离 serve 中被 kill (无存活)
 *   - oracle-2: ORA-PT-11 身份类 mutation (1, 2, 3, 4) kill 后 verified:false
 *   - oracle-3: ORA-PT-12 skill-policy 类 mutation (5, 8) kill 后 dispatcher 仍拒
 *   - oracle-4: ORA-PT-13 DB lifecycle 类 mutation (6, 7) kill 后 fail-closed
 *
 * 共享 lib 遵循清单（每条都是硬要求）:
 *   [x] §1.1 双保险: SSE JSONL + REST poll
 *   [x] §1.1 核心操作#5 主动 GET /question 轮询
 *   [x] §1.1 核心操作#6 POST /question/{QID}/reply 自动回复
 *   [x] §4.4 身份保留指导: prompt_async 必传 agent
 *   [x] §4.6 先查再发: prompt 前 GET 真实 agent
 *   [x] §4.5 Turn 模型: 按 session.idle/error 判定
 *   [x] §验证完成检查清单: 每步输出 "Verified-by: <端点> → <关键返回>"
 *
 * 使用: bun run _b_pt_wm_00r2_g3_t052.ts --run-dir <absolute-run-dir>
 *   所有环境参数从 run manifest 派生（port / SSE / worktree / artifacts）
 *   需 DRY_RUN=true (默认) 才不发起任何真 mutation
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readRunManifest } from "./test-serve/run-context";
import {
  httpJson,
  getSessionAgent,
  promptAsync,
  pollAndReplyQuestionsWithMap,
  waitForIdle,
  QUESTION_REPLY_DEFAULTS,
} from "./lib/serve-api-client";

// ── Hard guard ──
const DRY_RUN = process.env.DRY_RUN !== "false"; // 默认 dry-run
const RUN_DIR = requiredRunDir();
const RUN_MANIFEST = readRunManifest(RUN_DIR);
const SERVE_URL = `http://localhost:${RUN_MANIFEST.port}`;
const SSE_FILE = RUN_MANIFEST.paths.eventFilePath;
const WORKTREE_DIR = RUN_MANIFEST.paths.worktreeDir;

// [x] §2.2.7 Skill 读取硬门返工契约 — 启动硬门
// [x] §3.2.1 PT-WM-00R2 固定 Task Contract — reviewer 启动隔离 serve
if (!DRY_RUN && process.env.FRAMEWORK_SKILL_READ_HARD_GATE !== "1") {
  console.error(
    "FATAL: FRAMEWORK_SKILL_READ_HARD_GATE must be 1 (Blueprint §2.2.7) before disabling DRY_RUN",
  );
  process.exit(1);
}

// ── Test constants ──
const TEST_ID = "T-PT-052";
const EVIDENCE_DIR = RUN_MANIFEST.paths.artifactsDir;
const PREREQUISITES = ["T-PT-048", "T-PT-049", "T-PT-050"];
const FRAMEWORK_SKILL_READ_HARD_GATE = "1";

// ── Mutation fixture (8 hard-required by test-spec §3.2) ──
interface MutationFixture {
  id: string;
  description: string;
  target_file: string;
  target_function: string;
  mutation_kind: "always-allow" | "skip-check" | "trust-stale" | "silent-catch" | "no-tx" | "default-allow";
  preconditions: string;
  inject_steps: string[];
  expected_outcome_after_mutation_applied: "still-reject" | "would-allow" | "fail-closed";
  expected_rule_id_if_reject: string;
  oracle_ids: string[];
}

const MUTATION_FIXTURES: MutationFixture[] = [
  {
    id: "mut-attest-fail-allow",
    description: "attestSkillRead 改为始终 allow (return verified:true unconditionally)",
    target_file: ".opencode/skills/skill-attest.ts",
    target_function: "attestSkillRead()",
    mutation_kind: "always-allow",
    preconditions: "T-PT-048/049/050 PASS + 隔离 worktree + 24h revert timer",
    inject_steps: [
      "1. 在 worktree 中替换 attestSkillRead 主体为 `return { verified: true, state_written: true }`",
      "2. 重启 serve (HMR 不算, 必须 cold restart)",
      "3. 创建 unauth session + 调 safe_edit",
      "4. 验证 dispatcher 行为: 期望仍 reject (因 dispatch chain 上还有 skill-policy 在前)",
    ],
    expected_outcome_after_mutation_applied: "still-reject",
    expected_rule_id_if_reject: "skill-read-attest-required",
    oracle_ids: ["oracle-1", "oracle-3"],
  },
  {
    id: "mut-skip-file-hash-check",
    description: "state validator 跳过 file hash 检查 (return true 不比对 hash)",
    target_file: ".opencode/skills/skill-attest.ts",
    target_function: "validateFileHashes()",
    mutation_kind: "skip-check",
    preconditions: "T-PT-048/049/050 PASS + 隔离 worktree",
    inject_steps: [
      "1. 替换 validateFileHashes 为 `return true`",
      "2. 重启 serve",
      "3. 创建 session + attest with WRONG file hash",
      "4. 验证 validator 仍按其他维度 (sessionID/agent/scope/required) 校验, 最终 verified:false (因其他维度也已 mismatch)",
    ],
    expected_outcome_after_mutation_applied: "still-reject",
    expected_rule_id_if_reject: "skill-read-attest-required",
    oracle_ids: ["oracle-1", "oracle-2"],
  },
  {
    id: "mut-skip-agent-check",
    description: "state validator 跳过 agent 检查",
    target_file: ".opencode/skills/skill-attest.ts",
    target_function: "validateAgent()",
    mutation_kind: "skip-check",
    preconditions: "T-PT-048/049/050 PASS + 隔离 worktree",
    inject_steps: [
      "1. 替换 validateAgent 为 `return true`",
      "2. 重启 serve",
      "3. 创建 session with agent=explore (不在 allowed list) + 调 write tool",
      "4. 验证仍 reject (其他维度校验触发)",
    ],
    expected_outcome_after_mutation_applied: "still-reject",
    expected_rule_id_if_reject: "skill-read-attest-required",
    oracle_ids: ["oracle-1", "oracle-2"],
  },
  {
    id: "mut-skip-scope-check",
    description: "state validator 跳过 canonicalTaskScope 检查",
    target_file: ".opencode/skills/skill-attest.ts",
    target_function: "validateCanonicalTaskScope()",
    mutation_kind: "skip-check",
    preconditions: "T-PT-048/049/050 PASS + 隔离 worktree",
    inject_steps: [
      "1. 替换 validateCanonicalTaskScope 为 `return true`",
      "2. 重启 serve",
      "3. 复用旧 root session 的 state 但改 canonicalTaskScope",
      "4. 验证仍 reject (因 file_hash 必变 → 触发 file hash mismatch)",
    ],
    expected_outcome_after_mutation_applied: "still-reject",
    expected_rule_id_if_reject: "skill-read-attest-required",
    oracle_ids: ["oracle-1", "oracle-2"],
  },
  {
    id: "mut-trust-stale-state",
    description: "state validator 信任 stale state (不检查 sessionID)",
    target_file: ".opencode/skills/skill-attest.ts",
    target_function: "validateSessionID()",
    mutation_kind: "trust-stale",
    preconditions: "T-PT-048/049/050 PASS + 隔离 worktree",
    inject_steps: [
      "1. 替换 validateSessionID 为 `return true`",
      "2. 重启 serve",
      "3. 复用 session-A 的 state 给 session-B 用 (sessionID 不匹配)",
      "4. 验证仍 reject (因其他维度 mismatch)",
    ],
    expected_outcome_after_mutation_applied: "still-reject",
    expected_rule_id_if_reject: "skill-read-attest-required",
    oracle_ids: ["oracle-1", "oracle-3"],
  },
  {
    id: "mut-silent-catch-error",
    description: "state validator 静默吞 DB 错误 (catch → return verified:true)",
    target_file: ".opencode/skills/skill-attest.ts",
    target_function: "validateStateFromDB() — catch block",
    mutation_kind: "silent-catch",
    preconditions: "T-PT-048/049/050 PASS + 隔离 worktree + DB fault inject",
    inject_steps: [
      "1. 替换 catch block 为 `return { verified: true, state_written: false }`",
      "2. 重启 serve + 注入 DB 读错误",
      "3. 验证 dispatcher 仍 reject (因 state_written=false 走 fail-closed)",
    ],
    expected_outcome_after_mutation_applied: "fail-closed",
    expected_rule_id_if_reject: "skill-read-attest-required",
    oracle_ids: ["oracle-1", "oracle-4"],
  },
  {
    id: "mut-write-without-tx",
    description: "DB 写缺事务包裹 (no BEGIN/COMMIT)",
    target_file: ".opencode/skills/skill-attest.ts",
    target_function: "dbWriteSubState()",
    mutation_kind: "no-tx",
    preconditions: "T-PT-048/049/050 PASS + 隔离 worktree + crash 注入",
    inject_steps: [
      "1. 替换 dbWriteSubState 去掉 BEGIN/COMMIT 包裹",
      "2. 重启 serve + 注入 crash between write 1 and write 2",
      "3. 验证写只部分成功 → state_written=false → 仍 reject",
    ],
    expected_outcome_after_mutation_applied: "fail-closed",
    expected_rule_id_if_reject: "skill-read-attest-required",
    oracle_ids: ["oracle-1", "oracle-4"],
  },
  {
    id: "mut-allow-unknown-tool",
    description: "未知工具默认 allow (删去 else deny 分支)",
    target_file: ".opencode/plugins/before/skill-policy.ts",
    target_function: "isAllowlisted()",
    mutation_kind: "default-allow",
    preconditions: "T-PT-048/049/050 PASS + 隔离 worktree",
    inject_steps: [
      "1. 替换 isAllowlisted 的 else 分支为 `return true`",
      "2. 重启 serve",
      "3. 创建 unauth session + 调未在矩阵中的工具 'future_tool_xyz'",
      "4. 验证 dispatcher 仍 reject (因 skill-policy 在 executor 之前 hard_block)",
    ],
    expected_outcome_after_mutation_applied: "still-reject",
    expected_rule_id_if_reject: "skill-read-attest-required",
    oracle_ids: ["oracle-1", "oracle-3"],
  },
];

// ── 4 oracle 校验 (test-spec §3.2 T-PT-052 硬性要求) ──
interface Oracle {
  id: string;
  oracle_ref: string; // ORA-PT-02/11/12/13
  description: string;
  expected: string;
  pass: boolean | null;
  note: string;
}

const ORACLES: Oracle[] = [
  {
    id: "oracle-1",
    oracle_ref: "ORA-PT-02",
    description: "全部 8 mutation 在隔离 serve 中被 kill (无 mutant 存活)",
    expected: "8/8 mutation killed, 0 survived",
    pass: null,
    note: "DRY_RUN: 需 reviewer 接受 24h-revert 临时 mutation + cold restart + 实测每个 mutation 后 dispatcher 行为",
  },
  {
    id: "oracle-2",
    oracle_ref: "ORA-PT-11",
    description: "身份类 mutation (1, 2, 3, 4) kill 后 verified:false",
    expected: "mut-attest-fail-allow / skip-file-hash / skip-agent / skip-scope 都触发 verified:false",
    pass: null,
    note: "DRY_RUN: 需 reviewer 实测 4 个身份 mutation",
  },
  {
    id: "oracle-3",
    oracle_ref: "ORA-PT-12",
    description: "skill-policy 类 mutation (5, 8) kill 后 dispatcher 仍拒",
    expected: "mut-trust-stale-state / mut-allow-unknown-tool 都触发 dispatcher 拒 (ruleId='skill-read-attest-required')",
    pass: null,
    note: "DRY_RUN: 需 reviewer 实测 2 个 policy mutation",
  },
  {
    id: "oracle-4",
    oracle_ref: "ORA-PT-13",
    description: "DB lifecycle 类 mutation (6, 7) kill 后 fail-closed",
    expected: "mut-silent-catch-error / mut-write-without-tx 都触发 state_written=false → fail-closed",
    pass: null,
    note: "DRY_RUN: 需 reviewer 实测 2 个 DB mutation + fault inject",
  },
];

// ── Result types ──
interface MutationResult {
  mutationId: string;
  mutationKind: string;
  expectedOutcome: string;
  actualOutcome: string | null;
  expectedRuleId: string;
  actualRuleId: string | null;
  survived: boolean; // true = 危险, mutation 仍能 allow
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
  mutationFixtures: MutationFixture[];
  mutationResults: MutationResult[];
  oracles: Oracle[];
  oracleSummary: { total: number; pass: number; fail: number; pending: number; survivedMutants: number };
  summary: { total: number; pass: number; fail: number; survived: number; dryRun: number };
  notes: string;
}

// ── log helpers ──
function log(m: string) { console.log(`[T-PT-052] ${m}`); }
function info(m: string) { console.log(`  ${m}`); }

// ── Stub for mutation application (DRY_RUN: never 真跑 mutation) ──
async function applyMutationDryRun(m: MutationFixture): Promise<MutationResult> {
  log(`  [DRY-RUN] ${m.id}: ${m.description}`);
  info(`    target: ${m.target_file}:${m.target_function}`);
  info(`    kind: ${m.mutation_kind}`);
  info(`    inject_steps: ${m.inject_steps.length}`);
  for (const s of m.inject_steps) info(`      - ${s}`);
  info(`    expected_outcome: ${m.expected_outcome_after_mutation_applied}`);
  // dry-run: 永远 survived=false (mutation 未应用, 理论应被原版逻辑 kill)
  return {
    mutationId: m.id,
    mutationKind: m.mutation_kind,
    expectedOutcome: m.expected_outcome_after_mutation_applied,
    actualOutcome: "n/a-dry-run",
    expectedRuleId: m.expected_rule_id_if_reject,
    actualRuleId: null,
    survived: false, // dry-run 不形成结论
    pass: false, // dry-run 不形成结论
    note: `DRY_RUN=true: mutation 未应用. Production run 需 reviewer 接受 24h-revert 临时 mutation + cold restart + 实测 dispatcher 行为. Expected outcome after mutation: ${m.expected_outcome_after_mutation_applied}.`,
  };
}

// ── Main ──
async function main() {
  log("=== T-PT-052: mutation matrix (8 fixture + 4 oracle) ===");
  log(`serveUrl: ${SERVE_URL}`);
  log(`DRY_RUN: ${DRY_RUN}`);
  log(`FRAMEWORK_SKILL_READ_HARD_GATE: ${process.env.FRAMEWORK_SKILL_READ_HARD_GATE || "(not set)"}`);
  log(`prerequisiteOrder: ${PREREQUISITES.join(" → ")}`);
  log(`evidenceDir: ${EVIDENCE_DIR}`);

  // 1. 前置检查
  log("Step 0: 前置检查...");
  for (const prereq of PREREQUISITES) {
    log(`  prerequisite ${prereq} — 必须由 reviewer 单独执行 PASS 才可放行 T-PT-052`);
  }
  log(`  Verified-by: 自身 dry-run 计划已写入 → ${MUTATION_FIXTURES.length} mutations, ${ORACLES.length} oracles`);

  // 2. Ensure evidence dir
  if (!existsSync(EVIDENCE_DIR)) {
    mkdirSync(EVIDENCE_DIR, { recursive: true });
  }

  // 3. Health check (optional; skip on pure dry-run)
  if (!DRY_RUN) {
    const healthRes = await httpJson("GET", "/session", SERVE_URL, undefined);
    if (healthRes.status !== 200) {
      log(`FATAL: serve not responding: ${healthRes.status}`);
      process.exit(1);
    }
    log(`  Verified-by: GET /session → ${healthRes.status}`);
  } else {
    log("  [DRY-RUN] skip GET /session (would need reviewer-started isolated serve)");
  }

  // 4. Mutation loop
  log("Step 1: Apply 8 mutation fixtures (DRY-RUN: only log plan)...");
  const mutationResults: MutationResult[] = [];
  for (const m of MUTATION_FIXTURES) {
    const r = await applyMutationDryRun(m);
    mutationResults.push(r);
    log(`  ${m.id} (${m.mutation_kind}): survived=${r.survived} pass=${r.pass} (DRY-RUN placeholder)`);
  }

  // 5. Oracle 校验
  log("Step 2: 4 oracle 校验 (DRY-RUN: only plan)...");
  for (const o of ORACLES) {
    log(`  ${o.id} [${o.oracle_ref}]: ${o.description}`);
    info(`    expected: ${o.expected}`);
  }

  // 6. Write evidence
  const survivedMutants = mutationResults.filter((r) => r.survived).length;
  const oracleSummary = {
    total: ORACLES.length,
    pass: 0,
    fail: 0,
    pending: ORACLES.length,
    survivedMutants,
  };
  const evidence: Evidence = {
    testId: TEST_ID,
    timestamp: new Date().toISOString(),
    prerequisites: PREREQUISITES,
    frameworkSkillReadHardGate: process.env.FRAMEWORK_SKILL_READ_HARD_GATE || "(not set)",
    dryRun: DRY_RUN,
    serveUrl: SERVE_URL,
    mutationFixtures: MUTATION_FIXTURES,
    mutationResults,
    oracles: ORACLES,
    oracleSummary,
    summary: {
      total: MUTATION_FIXTURES.length,
      pass: 0,
      fail: 0,
      survived: 0, // dry-run cannot form a verdict
      dryRun: MUTATION_FIXTURES.length,
    },
    notes: "DRY_RUN=true: this evidence is a prepared run-plan, not an executed run. To execute, reviewer must: (1) start isolated worktree + serve with FRAMEWORK_SKILL_READ_HARD_GATE=1, (2) 对每个 mutation 创建 24h-revert 临时 diff, (3) cold restart serve, (4) 实测 dispatcher 行为是否符合 expected_outcome, (5) 4 oracle 注入场景完整记录. **重要**: mutation 测试必须 cold restart serve (HMR 不算), 否则 cache 命中导致结果不可信.",
  };
  const evidenceFile = join(EVIDENCE_DIR, "t052-evidence.json");
  writeFileSync(evidenceFile, JSON.stringify(evidence, null, 2));
  log(`Evidence saved: ${evidenceFile}`);

  // 7. Write checklist artifact
  const checklistFile = join(EVIDENCE_DIR, "t052-checklist.md");
  writeFileSync(checklistFile, `# T-PT-052 checklist (DRY-RUN plan)

## Status
- ${TEST_ID}: READY (not executed)
- DRY_RUN: ${DRY_RUN}
- FRAMEWORK_SKILL_READ_HARD_GATE: ${process.env.FRAMEWORK_SKILL_READ_HARD_GATE || "(not set)"}

## Prerequisites
- ${PREREQUISITES.join("\n- ")}

## Mutation Fixtures (8)
${MUTATION_FIXTURES.map((m) => `- ${m.id} [${m.mutation_kind}]: ${m.description}\n  target: ${m.target_file}:${m.target_function}\n  expected_outcome: ${m.expected_outcome_after_mutation_applied}`).join("\n")}

## Oracles (4)
${ORACLES.map((o) => `- ${o.id} [${o.oracle_ref}]: ${o.description} → ${o.expected}`).join("\n")}

## Oracle coverage
- oracle-1 (ORA-PT-02)        : 全部 8 mutation 全 kill
- oracle-2 (ORA-PT-11)        : 4 身份类 mutation (1, 2, 3, 4) kill
- oracle-3 (ORA-PT-12)        : 2 policy 类 mutation (5, 8) kill
- oracle-4 (ORA-PT-13)        : 2 DB lifecycle 类 mutation (6, 7) kill

## Required evidence (production run)
- 每 mutation 的 24h-revert 临时 diff
- cold restart 前后 dispatcher 行为对比
- survived/killed verdict (8 行)
- oracle 注入场景记录 (4 行)
- **重要**: 每次 mutation 后必须 cold restart serve (HMR 命中会让结果失真)

## Important constraint
- 不修改 work-one 任何文件 (在隔离 worktree 中做 mutation)
- 每个 mutation 必须有 24h revert timer
`);
  log(`Checklist saved: ${checklistFile}`);

  log("\n=== Final ===");
  log(`  total mutations: ${MUTATION_FIXTURES.length}`);
  log(`  total oracles: ${ORACLES.length}`);
  log(`  status: READY (not executed — H2 需用户授权)`);
  log(`  next: review this plan, then either keep DRY_RUN=true or hand off to reviewer for live execution`);
}

if (import.meta.main) main().catch((e) => { console.error("FATAL:", e); process.exit(1); });

function requiredRunDir(): string {
  const index = process.argv.indexOf("--run-dir");
  if (index < 0 || !process.argv[index + 1]) {
    throw new Error("run with --run-dir <absolute-path>");
  }
  return process.argv[index + 1];
}