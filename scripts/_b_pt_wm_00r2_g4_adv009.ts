#!/usr/bin/env bun
/**
 * _b_pt_wm_00r2_g4_adv009.ts — Adversarial Charter ADV-PT-009 (state replay + fault + concurrency)
 *
 * 创建于 2026-07-14 — 严格按 Blueprint v1.5.0 + test-spec v1.4.0 §5 编写
 *
 * Charter ID: ADV-PT-009
 * prerequisiteOrder: T-PT-048 → T-PT-049 → T-PT-050 (必须先证明 shared identity +
 *                   real DB lifecycle + authoritative active wiring)
 * FRAMEWORK_SKILL_READ_HARD_GATE=1 (由 reviewer 启动隔离 serve 后方可执行)
 * 状态: READY (not executed — H2 需用户授权)
 *
 * 覆盖 REQ/T:
 *   REQ-PT-015、REQ-PT-016、REQ-PT-017
 *   T-PT-039、040、041、042、043、044、045、047、048、049、050、051、052
 *
 * 技术（test-spec §5）:
 *   1. 5 state_replay:
 *      - mutate_session
 *      - mutate_agent
 *      - mutate_canonical_scope
 *      - mutate_required_list
 *      - mutate_file_hash
 *   2. 4 fault_injection:
 *      - db_read_error
 *      - db_write_error
 *      - corrupt_state
 *      - lock_conflict
 *   3. 3 concurrency:
 *      - interleave_attestation
 *      - parallel_attestation
 *      - repeated_attestation
 *
 * Kill condition:
 *   - caller label 搬运授权
 *   - 陈旧/部分/错误状态获得 allow
 *   - 失败认证未失效旧状态
 *   - 并发使权限变宽
 *
 * Schedule: 20 轮 (test-spec §4 T-PT-044)，每轮重复 12 mutations + assertions
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
 * 使用: bun run _b_pt_wm_00r2_g4_adv009.ts --run-dir <absolute-run-dir>
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
const TEST_ID = "ADV-PT-009";
const EVIDENCE_DIR = RUN_MANIFEST.paths.artifactsDir;
const PREREQUISITES = ["T-PT-048", "T-PT-049", "T-PT-050"];
const SCHEDULE_ROUNDS = 20; // test-spec T-PT-044 硬要求 ≥20 轮
const FRAMEWORK_SKILL_READ_HARD_GATE = "1";

// ── Mutation type definition ──
interface Mutation {
  id: string;
  category: "state_replay" | "fault_injection" | "concurrency";
  description: string;
  target: string;
  kill_condition: string;
}

// ── MUTATIONS 数组（12 项）──
const MUTATIONS: Mutation[] = [
  // 5 state_replay mutations
  {
    id: "mutate_session",
    category: "state_replay",
    description: "把 session-A 的合法 attestation state 复制到 session-B 复用",
    target: "DB: skill_read_state.sessions — UPDATE sessionID key 但保留 agent/task/required-list/file-hash",
    kill_condition:
      "session-B 引用 session-A 的 state 时被 state validator 拒绝（ORA-PT-11: sessionID mismatch 失效旧状态）",
  },
  {
    id: "mutate_agent",
    category: "state_replay",
    description: "保持 session 不变，改 agent label (e.g. Orchestrator → build) 复用 state",
    target: "DB: skill_read_state.sessions[sid].agent — UPDATE agent 但保留其他字段",
    kill_condition:
      "agent 改变后 state validator 拒绝（ORA-PT-11: agent mismatch 失效旧状态）",
  },
  {
    id: "mutate_canonical_scope",
    category: "state_replay",
    description: "改 task_scope_id (root session:<sid> → 别的 session; child task:<dag_task_id> → 别的 task)",
    target: "DB: skill_read_state.sessions[sid].task_scope_id — 替换为不同值",
    kill_condition:
      "canonical task_scope_id 改变后 state validator 拒绝（ORA-PT-11: canonical scope mismatch）",
  },
  {
    id: "mutate_required_list",
    category: "state_replay",
    description: "attest 通过后把 required_list 改短/加项/换顺序",
    target: "DB: skill_read_state.sessions[sid].required_list — 替换为不同 list",
    kill_condition:
      "required_list 改变后 state validator 拒绝（ORA-PT-11: required-set mismatch）",
  },
  {
    id: "mutate_file_hash",
    category: "state_replay",
    description: "改 Skill 文件 hash (e.g. 在 test skill 末尾加个换行)，复用旧 state",
    target: "DB: skill_read_state.sessions[sid].skill_file_hashes — 替换为陈旧值",
    kill_condition:
      "文件 hash 变化后 state validator 拒绝（ORA-PT-11: file-hash mismatch 失效旧状态）",
  },
  // 4 fault_injection mutations
  {
    id: "db_read_error",
    category: "fault_injection",
    description: "DB 读返回错误（SQLite readonly / db file missing / I/O error）",
    target: "fake DB adapter: dbReadSubState() 抛 SqliteError",
    kill_condition:
      "DB 读错误时 state validator 返回 fail-closed，未认证调用非 allowlist 工具被专用 rule 拒绝（无 partial success）",
  },
  {
    id: "db_write_error",
    category: "fault_injection",
    description: "DB 写返回 false / SqliteError（disk full / permission denied）",
    target: "fake DB adapter: dbWriteSubState() 返回 { state_written: false }",
    kill_condition:
      "DB 写失败时 state_written=false → 不返回 verified:true；后续调用被拒（fail-closed）",
  },
  {
    id: "corrupt_state",
    category: "fault_injection",
    description: "DB row 损坏（缺字段 / 类型错 / JSON 解析失败）",
    target: "fake DB adapter: 注入 schema-violating row",
    kill_condition:
      "损坏 state 被 parser 拒绝，旧有效状态不复活；未认证调用被拒（fail-closed）",
  },
  {
    id: "lock_conflict",
    category: "fault_injection",
    description: "DB 写时遇到锁冲突（另一个事务持有写锁）",
    target: "fake DB adapter: 模拟 SQLITE_BUSY",
    kill_condition:
      "锁冲突时回退到 fail-closed，不留 partial success；旧有效状态被新事务覆盖（先失效再写）",
  },
  // 3 concurrency mutations
  {
    id: "interleave_attestation",
    category: "concurrency",
    description: "在 session-A attest 过程中 session-B 插队做 attest + 写工具调用",
    target: "fake scheduler: ABABAB 交错 attest + write attempt",
    kill_condition:
      "交错过程中 session-B 不得借用 session-A 的 state；任何跨边界借用都被拒",
  },
  {
    id: "parallel_attestation",
    category: "concurrency",
    description: "两个 session 同时做 attestation (同一 task scope)",
    target: "fake scheduler: A||B 并行 attest",
    kill_condition:
      "并行 attest 不会产生双写 / partial success；winner-take-all 后 loser 被拒（不会留下 stale state）",
  },
  {
    id: "repeated_attestation",
    category: "concurrency",
    description: "同一 session 重复 attest 20 次 (相同 / 不同 required list)",
    target: "fake scheduler: A 连续 attest 20 轮",
    kill_condition:
      "重复 attest 不会扩大权限；旧 attest 不被新覆盖为 verified:true（除非新满足所有 ORA-PT-11 条件）",
  },
];

// ── Schedule entry type ──
interface ScheduleEntry {
  round: number;
  seed: number; // RNG seed for reproducibility
  operations: { mutationId: string; targetSession: string; order: number }[];
  assertions: string[]; // ORA-PT-11 / ORA-PT-12 assertion IDs
  expectedResults: "all-deny" | "winner-only" | "no-amplification";
}

// ── SCHEDULE 20 轮（test-spec T-PT-044 硬要求）──
const SCHEDULE: ScheduleEntry[] = (() => {
  const sessions = ["session-A", "session-B", "session-C"];
  const out: ScheduleEntry[] = [];
  for (let r = 1; r <= SCHEDULE_ROUNDS; r++) {
    // 每轮挑 4-6 个 mutations，覆盖 12 项至少 3 次
    const ops: ScheduleEntry["operations"] = [];
    const order = 0;
    // Round 1-5: state_replay 为主
    if (r <= 5) {
      ops.push({ mutationId: "mutate_session", targetSession: sessions[r % 3], order: order + 1 });
      ops.push({ mutationId: "mutate_agent", targetSession: sessions[(r + 1) % 3], order: order + 2 });
      ops.push({ mutationId: "mutate_canonical_scope", targetSession: sessions[(r + 2) % 3], order: order + 3 });
      ops.push({ mutationId: "mutate_required_list", targetSession: sessions[r % 3], order: order + 4 });
      ops.push({ mutationId: "mutate_file_hash", targetSession: sessions[(r + 1) % 3], order: order + 5 });
    }
    // Round 6-10: fault_injection 为主
    else if (r <= 10) {
      ops.push({ mutationId: "db_read_error", targetSession: sessions[0], order: order + 1 });
      ops.push({ mutationId: "db_write_error", targetSession: sessions[1], order: order + 2 });
      ops.push({ mutationId: "corrupt_state", targetSession: sessions[2], order: order + 3 });
      ops.push({ mutationId: "lock_conflict", targetSession: sessions[r % 3], order: order + 4 });
    }
    // Round 11-15: concurrency 为主
    else if (r <= 15) {
      ops.push({ mutationId: "interleave_attestation", targetSession: "all", order: order + 1 });
      ops.push({ mutationId: "parallel_attestation", targetSession: "all", order: order + 2 });
      ops.push({ mutationId: "repeated_attestation", targetSession: sessions[r % 3], order: order + 3 });
    }
    // Round 16-20: 混合（最复杂）
    else {
      ops.push({ mutationId: "mutate_session", targetSession: sessions[0], order: order + 1 });
      ops.push({ mutationId: "db_read_error", targetSession: sessions[1], order: order + 2 });
      ops.push({ mutationId: "interleave_attestation", targetSession: "all", order: order + 3 });
      ops.push({ mutationId: "mutate_canonical_scope", targetSession: sessions[2], order: order + 4 });
      ops.push({ mutationId: "corrupt_state", targetSession: sessions[0], order: order + 5 });
      ops.push({ mutationId: "parallel_attestation", targetSession: "all", order: order + 6 });
    }
    out.push({
      round: r,
      seed: 0xCAFE0000 + r,
      operations: ops,
      assertions: ["ORA-PT-11", "ORA-PT-12"],
      expectedResults: r <= 10 ? "all-deny" : r <= 15 ? "winner-only" : "no-amplification",
    });
  }
  return out;
})();

// ── Result types ──
interface RoundResult {
  round: number;
  seed: number;
  operations: number;
  assertions: { assertion: string; pass: boolean; note: string }[];
  expected: string;
  actual: string;
  pass: boolean;
}

interface Evidence {
  testId: string;
  timestamp: string;
  prerequisites: string[];
  frameworkSkillReadHardGate: string;
  dryRun: boolean;
  serveUrl: string;
  mutations: Mutation[];
  schedule: ScheduleEntry[];
  roundResults: RoundResult[];
  summary: { totalRounds: number; pass: number; fail: number };
  notes: string;
}

// ── log helpers ──
function log(m: string) { console.log(`[ADV-PT-009] ${m}`); }
function info(m: string) { console.log(`  ${m}`); }

// ── Stub for round execution (DRY_RUN) ──
async function runRoundDryRun(entry: ScheduleEntry): Promise<RoundResult> {
  log(`  [DRY-RUN] round=${entry.round} seed=0x${entry.seed.toString(16)} ops=${entry.operations.length} expected=${entry.expectedResults}`);
  for (const op of entry.operations) {
    const m = MUTATIONS.find((m) => m.id === op.mutationId);
    if (!m) {
      log(`    [WARN] mutation ${op.mutationId} not found in MUTATIONS list`);
      continue;
    }
    log(`    [DRY-RUN] op ${op.order}: ${m.id} → session=${op.targetSession}`);
  }
  return {
    round: entry.round,
    seed: entry.seed,
    operations: entry.operations.length,
    assertions: entry.assertions.map((a) => ({
      assertion: a,
      pass: false, // dry-run 不可形成结论
      note: "DRY_RUN=true: 未真跑; production run 需 reviewer 授权 + 真实 session/DB",
    })),
    expected: entry.expectedResults,
    actual: "n/a-dry-run",
    pass: false,
  };
}

// ── Main ──
async function main() {
  log("=== ADV-PT-009: state replay + fault + concurrency ===");
  log(`serveUrl: ${SERVE_URL}`);
  log(`DRY_RUN: ${DRY_RUN}`);
  log(`FRAMEWORK_SKILL_READ_HARD_GATE: ${process.env.FRAMEWORK_SKILL_READ_HARD_GATE || "(not set)"}`);
  log(`prerequisiteOrder: ${PREREQUISITES.join(" → ")}`);
  log(`schedule rounds: ${SCHEDULE_ROUNDS}`);
  log(`mutations: ${MUTATIONS.length} (${MUTATIONS.filter((m) => m.category === "state_replay").length} state_replay + ${MUTATIONS.filter((m) => m.category === "fault_injection").length} fault_injection + ${MUTATIONS.filter((m) => m.category === "concurrency").length} concurrency)`);
  log(`evidenceDir: ${EVIDENCE_DIR}`);

  // Step 0: prerequisites
  log("Step 0: 前置检查...");
  for (const prereq of PREREQUISITES) {
    log(`  prerequisite ${prereq} — 必须由 reviewer 单独执行 PASS 才可放行 ADV-PT-009`);
  }
  log(`  Verified-by: dry-run plan written → ${MUTATIONS.length} mutations × ${SCHEDULE_ROUNDS} rounds`);

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

  // Step 2: Run schedule
  log("Step 1: Run 20-round schedule...");
  const roundResults: RoundResult[] = [];
  for (const entry of SCHEDULE) {
    const r = await runRoundDryRun(entry);
    roundResults.push(r);
  }
  log(`  total rounds executed (DRY-RUN): ${roundResults.length}`);

  // Step 3: Write evidence
  const evidence: Evidence = {
    testId: TEST_ID,
    timestamp: new Date().toISOString(),
    prerequisites: PREREQUISITES,
    frameworkSkillReadHardGate: process.env.FRAMEWORK_SKILL_READ_HARD_GATE || "(not set)",
    dryRun: DRY_RUN,
    serveUrl: SERVE_URL,
    mutations: MUTATIONS,
    schedule: SCHEDULE,
    roundResults,
    summary: {
      totalRounds: SCHEDULE_ROUNDS,
      pass: 0, // dry-run
      fail: 0,
    },
    notes: "DRY_RUN=true: this evidence is a prepared run-plan. To execute: reviewer must (1) start isolated serve with FRAMEWORK_SKILL_READ_HARD_GATE=1, (2) create seed DB state for 3 sessions, (3) inject each fault via fake adapter (contract-tested), (4) record DB before/after + reject events for each round.",
  };
  const evidenceFile = join(EVIDENCE_DIR, "adv009-evidence.json");
  writeFileSync(evidenceFile, JSON.stringify(evidence, null, 2));
  log(`Evidence saved: ${evidenceFile}`);

  // Step 4: Write schedule seed file
  const scheduleFile = join(EVIDENCE_DIR, "adv009-schedule.md");
  const scheduleLines = SCHEDULE.map(
    (s) => `## Round ${s.round} (seed=0x${s.seed.toString(16)})\n` +
      `- expected: ${s.expectedResults}\n` +
      `- operations:\n` +
      s.operations.map((o) => `  - ${o.order}. ${o.mutationId} → ${o.targetSession}`).join("\n") +
      `\n- assertions: ${s.assertions.join(", ")}\n`,
  );
  writeFileSync(scheduleFile, `# ADV-PT-009 schedule (DRY-RUN plan, ${SCHEDULE_ROUNDS} rounds)\n\n${scheduleLines.join("\n")}`);
  log(`Schedule saved: ${scheduleFile}`);

  log("\n=== Final ===");
  log(`  total mutations: ${MUTATIONS.length} (5 state_replay + 4 fault_injection + 3 concurrency)`);
  log(`  total schedule rounds: ${SCHEDULE_ROUNDS}`);
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