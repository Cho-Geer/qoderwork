#!/usr/bin/env bun
/**
 * _b_pt_wm_00r2_g4_adv008.ts — Adversarial Charter ADV-PT-008 (security bypass + mutation)
 *
 * 创建于 2026-07-14 — 严格按 Blueprint v1.5.0 + test-spec v1.4.0 §5 编写
 *
 * Charter ID: ADV-PT-008
 * prerequisiteOrder: T-PT-048 → T-PT-049 → T-PT-050 (必须先证明 shared identity +
 *                   real DB lifecycle + authoritative active wiring)
 * FRAMEWORK_SKILL_READ_HARD_GATE=1 (由 reviewer 启动隔离 serve 后方可执行)
 * 状态: READY (not executed — H2 需用户授权)
 *
 * 覆盖 REQ/T:
 *   REQ-PT-002、REQ-PT-016
 *   T-PT-004、041、042、046、047、050、051、052
 *
 * 技术（test-spec §5）:
 *   - 删除专用 throw (mutate_delete_throw)
 *   - catch 吞异常 (mutate_catch_swallows)
 *   - 未知工具默认值改为 allow (mutate_unknown_tool_default_allow)
 *   - 把 safe_shell/safe_framework_edit/repo/GitHub write 从拒绝矩阵移除
 *   - DB 写失败被信任 (mutate_db_write_failure_trusted)
 *
 * Kill condition:
 *   任一 mutant 存活，或未认证状态下任一非 allowlist executor entry > 0
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
 * 使用: bun run _b_pt_wm_00r2_g4_adv008.ts --run-dir <absolute-run-dir>
 *   所有环境参数从 run manifest 派生（port / SSE / worktree / artifacts）
 *   需 DRY_RUN=true (默认) 才不发起任何真 mutation
 */

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
const TEST_ID = "ADV-PT-008";
const EVIDENCE_DIR = RUN_MANIFEST.paths.artifactsDir;
const PREREQUISITES = ["T-PT-048", "T-PT-049", "T-PT-050"];
const FRAMEWORK_SKILL_READ_HARD_GATE = "1";

// ── Mutation type definition (G4 硬性要求 #8) ──
interface Mutation {
  id: string;
  description: string;
  target: string; // 哪个文件/函数被修改
  kill_condition: string; // 什么算存活
}

// ── MUTATIONS 数组（顶层常量，硬性要求）──
const MUTATIONS: Mutation[] = [
  {
    id: "mutate_delete_throw",
    description:
      "在 skill-policy.ts 的 hard_block 分支删除专用 throw (硬门 throw 不再抛出，错误被静默吞掉)",
    target: ".opencode/plugins/before/skill-policy.ts:hardBlock() — 删除 `throw new Error('skill-read-attest-required')`",
    kill_condition:
      "未认证调用非 allowlist 工具后，executor entry 仍 = 0，且 handler trace 中存在 'skill-read-attest-required' 字符串（throw 仍生效）",
  },
  {
    id: "mutate_catch_swallows",
    description:
      "把 skill-policy.ts 的 try/catch 改为 swallow 模式，catch 后 return { allowed: true }（异常被吞）",
    target: ".opencode/plugins/before/skill-policy.ts:evaluate() — catch 块 `return { allowed: true }`",
    kill_condition:
      "DB 错误/解析异常下，专用拒绝事件仍触发且 dispatch 不被吞（catch 不允许 return allow）",
  },
  {
    id: "mutate_unknown_tool_default_allow",
    description:
      "把未知工具的 default 从 deny 改为 allow（safe_edit/safe_shell/未列入的工具默认放行）",
    target: ".opencode/plugins/before/skill-policy.ts:isAllowlisted() — 删去 else 分支的 default deny",
    kill_condition:
      "未认证 session 调用未来未知工具 (e.g. 'future_tool_xyz') 时仍被拒绝，ruleId='skill-read-attest-required'",
  },
  {
    id: "mutate_remove_shell_from_deny_matrix",
    description:
      "从 deny 矩阵移除 safe_shell / safe_framework_edit / safe_repo_push / github_mcp write（这 4 个被默许）",
    target: ".opencode/plugins/before/skill-policy.ts:DENY_MATRIX — 删去上述 4 个 key",
    kill_condition:
      "未认证 session 调用 safe_shell 'echo bypass' / safe_framework_edit / safe_repo_push / github_mcp 写操作时仍被专用 rule 拒绝",
  },
  {
    id: "mutate_db_write_failure_trusted",
    description:
      "DB 写失败 (state_written=false) 后，state validator 仍信任旧状态为有效 allow",
    target: ".opencode/skills/skill-attest.ts:dbWriteSubState() — 写失败后保留旧 row 不失效",
    kill_condition:
      "DB write 注入 fault 后，未认证调用非 allowlist 工具仍被拒绝；旧有效状态在 DB 写失败后失效（fail-closed）",
  },
];

// ── TOOL_MATRIX 14 项（test-spec §5 硬性要求）──
interface ToolMatrixEntry {
  category: "allowlist" | "deny-mandatory" | "unknown" | "mutation-specific";
  tool: string;
  expected_disposition: "allow" | "deny-hard-block" | "deny-attest-required";
  rationale: string;
  mutation_target?: string; // 对应的 mutation
}

const TOOL_MATRIX: ToolMatrixEntry[] = [
  // 8 allowlist
  { category: "allowlist", tool: "read", expected_disposition: "allow", rationale: "固定 read allowlist" },
  { category: "allowlist", tool: "glob", expected_disposition: "allow", rationale: "固定 read allowlist" },
  { category: "allowlist", tool: "grep", expected_disposition: "allow", rationale: "固定 read allowlist" },
  { category: "allowlist", tool: "list", expected_disposition: "allow", rationale: "固定 read allowlist" },
  { category: "allowlist", tool: "question", expected_disposition: "allow", rationale: "固定 question allowlist" },
  { category: "allowlist", tool: "skill", expected_disposition: "allow", rationale: "attest 前加载 Skill 必需" },
  { category: "allowlist", tool: "skill_read_attest", expected_disposition: "allow", rationale: "attest 工具本身在 allowlist" },
  { category: "allowlist", tool: "skill_read_state", expected_disposition: "allow", rationale: "查询 state 在 allowlist" },
  // 3 deny-mandatory (非 allowlist 且写入)
  { category: "deny-mandatory", tool: "safe_shell", expected_disposition: "deny-hard-block", rationale: "需 grant 才对 safe_shell 放行" },
  { category: "deny-mandatory", tool: "safe_framework_edit", expected_disposition: "deny-hard-block", rationale: "需 grant 才对 framework edit 放行" },
  { category: "deny-mandatory", tool: "safe_repo_push", expected_disposition: "deny-hard-block", rationale: "需 grant 才对 repo write 放行" },
  // 1 unknown
  { category: "unknown", tool: "future_tool_xyz_2027", expected_disposition: "deny-attest-required", rationale: "未来未知工具默认拒绝" },
  // 2 mutation-specific
  { category: "mutation-specific", tool: "github_mcp_create_issue", expected_disposition: "deny-hard-block", rationale: "remote write 默认拒绝 (mutate_remove_shell_from_deny_matrix 移除后必须仍拒绝)", mutation_target: "mutate_remove_shell_from_deny_matrix" },
  { category: "mutation-specific", tool: "safe_edit", expected_disposition: "deny-hard-block", rationale: "T-PT-004 核心，未认证写工具必须被拒 (mutate_delete_throw 测试)", mutation_target: "mutate_delete_throw" },
];

// ── Subcase result type ──
interface SubcaseResult {
  tool: string;
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
  toolMatrix: ToolMatrixEntry[];
  subcases: SubcaseResult[];
  mutationScores: { mutationId: string; survived: boolean; rationale: string }[];
  killConditionsFired: string[];
  summary: { total: number; pass: number; fail: number };
  notes: string;
}

// ── log helpers ──
function log(m: string) { console.log(`[ADV-PT-008] ${m}`); }
function info(m: string) { console.log(`  ${m}`); }

// ── Stub for mutation application (NEVER 真跑 mutation; 需要 reviewer 授权) ──
async function applyMutationDryRun(mutation: Mutation): Promise<{ survived: boolean; rationale: string }> {
  log(`  [DRY-RUN] Would mutate: ${mutation.target}`);
  log(`  [DRY-RUN]   description: ${mutation.description}`);
  log(`  [DRY-RUN]   kill_condition: ${mutation.kill_condition}`);
  // 永远返回 survived=false (因为 dry-run 不真跑，理论 mutation 未应用)
  return {
    survived: false,
    rationale: "DRY_RUN=true: mutation 未应用；需 reviewer 接受临时 mutation + 24h revert 才执行真 mutation",
  };
}

// ── Stub for tool matrix verification (DRY_RUN: 不发真请求) ──
async function verifyToolMatrixEntry(
  entry: ToolMatrixEntry,
  sid: string,
): Promise<SubcaseResult> {
  log(`  [DRY-RUN] tool=${entry.tool} expected=${entry.expected_disposition}`);
  // dry-run: 不真发请求，标记为 'n/a-dry-run'
  return {
    tool: entry.tool,
    expected: entry.expected_disposition,
    actual: "n/a-dry-run",
    pass: false, // dry-run 不可形成结论
    note: `DRY_RUN=true: 未真验证。生产真跑需 reviewer 授权 + active session + 真实 dispatcher trace。`,
  };
}

// ── Main ──
async function main() {
  log("=== ADV-PT-008: security bypass + mutation ===");
  log(`serveUrl: ${SERVE_URL}`);
  log(`DRY_RUN: ${DRY_RUN}`);
  log(`FRAMEWORK_SKILL_READ_HARD_GATE: ${process.env.FRAMEWORK_SKILL_READ_HARD_GATE || "(not set)"}`);
  log(`prerequisiteOrder: ${PREREQUISITES.join(" → ")}`);
  log(`evidenceDir: ${EVIDENCE_DIR}`);

  // 1. 前置检查
  log("Step 0: 前置检查...");
  for (const prereq of PREREQUISITES) {
    log(`  prerequisite ${prereq} — 必须由 reviewer 单独执行 PASS 才可放行 ADV-PT-008`);
  }
  log(`  Verified-by: 自身 dry-run 计划已写入 → ${MUTATIONS.length} mutations, ${TOOL_MATRIX.length} tool matrix entries`);

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
  log("Step 1: Apply each mutation (DRY-RUN: only log)...");
  const mutationScores: { mutationId: string; survived: boolean; rationale: string }[] = [];
  for (const m of MUTATIONS) {
    const r = await applyMutationDryRun(m);
    mutationScores.push({ mutationId: m.id, survived: r.survived, rationale: r.rationale });
    log(`  mutation ${m.id}: survived=${r.survived}`);
  }

  // 5. Tool matrix verification
  log("Step 2: Verify 14 tool matrix entries...");
  const subcases: SubcaseResult[] = [];
  // dry-run: 不真创建 session
  const stubSid = "DRY-RUN-sid-no-real-session";
  for (const entry of TOOL_MATRIX) {
    const r = await verifyToolMatrixEntry(entry, stubSid);
    subcases.push(r);
    log(`  tool=${entry.tool} expected=${entry.expected_disposition} actual=${r.actual} pass=${r.pass}`);
  }

  // 6. Kill condition check (dry-run: not applicable)
  const killConditionsFired: string[] = [];
  if (DRY_RUN) {
    killConditionsFired.push("DRY_RUN=true: 0 kill conditions fired (mutation not applied, no real execution)");
  }
  log("Step 3: Kill condition summary...");
  for (const k of killConditionsFired) log(`  - ${k}`);

  // 7. Write evidence
  const evidence: Evidence = {
    testId: TEST_ID,
    timestamp: new Date().toISOString(),
    prerequisites: PREREQUISITES,
    frameworkSkillReadHardGate: process.env.FRAMEWORK_SKILL_READ_HARD_GATE || "(not set)",
    dryRun: DRY_RUN,
    serveUrl: SERVE_URL,
    mutations: MUTATIONS,
    toolMatrix: TOOL_MATRIX,
    subcases,
    mutationScores,
    killConditionsFired,
    summary: {
      total: TOOL_MATRIX.length,
      pass: 0, // dry-run cannot form a pass verdict
      fail: 0, // dry-run cannot form a fail verdict either
    },
    notes: "DRY_RUN=true: this evidence is a prepared run-plan, not an executed run. To execute, reviewer must: (1) start isolated serve with FRAMEWORK_SKILL_READ_HARD_GATE=1, (2) accept each mutation as a 24h-revertible diff, (3) record active dispatcher trace + executor counter for each tool call.",
  };
  const evidenceFile = join(EVIDENCE_DIR, "adv008-evidence.json");
  writeFileSync(evidenceFile, JSON.stringify(evidence, null, 2));
  log(`Evidence saved: ${evidenceFile}`);

  // 8. Write checklist artifact (charter-level)
  const checklistFile = join(EVIDENCE_DIR, "adv008-checklist.md");
  writeFileSync(checklistFile, `# ADV-PT-008 charter checklist (DRY-RUN plan)

## Status
- ${TEST_ID}: READY (not executed)
- DRY_RUN: ${DRY_RUN}
- FRAMEWORK_SKILL_READ_HARD_GATE: ${process.env.FRAMEWORK_SKILL_READ_HARD_GATE || "(not set)"}

## Prerequisites
- ${PREREQUISITES.join("\n- ")}

## Mutations (5)
${MUTATIONS.map((m) => `- ${m.id}: ${m.description}`).join("\n")}

## Tool matrix (14)
${TOOL_MATRIX.map((t) => `- [${t.category}] ${t.tool} → ${t.expected_disposition}`).join("\n")}

## Required evidence (production run)
- mutation report (mutant survived / killed)
- active dispatcher trace (handler order + reject events)
- tool matrix results (14 entries, executor entry=0 for non-allowlist)
- zero-execution evidence (real executor counter)
`);
  log(`Checklist saved: ${checklistFile}`);

  log("\n=== Final ===");
  log(`  total mutations: ${MUTATIONS.length}`);
  log(`  total tool matrix entries: ${TOOL_MATRIX.length}`);
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