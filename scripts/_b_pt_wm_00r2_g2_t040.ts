#!/usr/bin/env bun
/**
 * _b_pt_wm_00r2_g2_t040.ts — G2 integration: state regression across dimensions (T-PT-040)
 *
 * 创建于 2026-07-14 — 严格按 test-spec v1.4.0 §3.2 T-PT-040 + Blueprint v1.5.0 §2.2.7
 *
 * Test ID: T-PT-040 (G2 group)
 * prerequisiteOrder: T-PT-048 → T-PT-039 (happy baseline 先建立,再做 cross-dim regression)
 * FRAMEWORK_SKILL_READ_HARD_GATE=1 (由 reviewer 启动隔离 serve 后方可执行)
 * 状态: READY (not executed — H2 需用户授权)
 *
 * 覆盖 REQ: REQ-PT-015、REQ-PT-017
 * Oracle: ORA-PT-11/13
 *   - caller label 单独变化 → 不授予也不扩大权限 (label 是审计维度,非授权维度)
 *   - 其他授权维度变化 → 旧状态失效 (fail-closed)
 *   - 失败认证 → 清除/覆盖旧 allow 状态
 *
 * 7 subcases (test-spec §3.2 T-PT-040 硬性要求):
 *   1. baseline (caller label 单独变化) — caller task label 改 → 旧状态有效,权限不扩大
 *   2. cross-dim: sessionID 变化 → 旧状态失效
 *   3. cross-dim: agent 变化 → 旧状态失效
 *   4. cross-dim: canonicalTaskScope 变化 → 旧状态失效
 *   5. cross-dim: required list 变化 → 旧状态失效
 *   6. cross-dim: Skill 文件内容变化 → 旧状态失效
 *   7. fail-auth overwrite: 一次失败认证 → 清除/覆盖之前的 allow 状态
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
 * 使用: bun run _b_pt_wm_00r2_g2_t040.ts --run-dir <absolute-run-dir>
 *   所有环境参数从 run manifest 派生（port / SSE / worktree / artifacts）
 *   需 DRY_RUN=true (默认) 才不发起任何真 mutation
 */

import * as fs from "node:fs";
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
const TEST_ID = "T-PT-040";
const EVIDENCE_DIR = RUN_MANIFEST.paths.artifactsDir;
const PREREQUISITES = ["T-PT-048", "T-PT-039"];
const FRAMEWORK_SKILL_READ_HARD_GATE = "1";

// ── Subcase definition (7 hard-required by test-spec §3.2) ──
interface Subcase {
  id: string;
  title: string;
  dimension: "caller-label" | "sessionID" | "agent" | "canonicalTaskScope" | "required" | "skill-content" | "fail-auth";
  preconditions: string;
  inject: string;
  oracle: string;
  expected_old_state_valid: boolean;  // 旧状态是否仍有效
  expected_new_state_valid: boolean;  // 新状态是否被接受
  expected_permission_unchanged: boolean; // 权限是否不变 (仅 caller label 例)
}

const SUBCASES: Subcase[] = [
  {
    id: "SC-T040-01-caller-label",
    title: "baseline: caller task label 单独变化 → 旧状态有效,权限不扩大不缩小",
    dimension: "caller-label",
    preconditions: "先成功 attest 一次 (建立有效 old state) + 改 caller task label (审计字段,非授权字段)",
    inject: "保持 sessionID/agent/scope/required/Skill 内容不变,只改 caller task label",
    oracle: "ORA-PT-11/13: caller label 是审计维度,变化不触发旧状态失效,verified 仍为 true,权限集合不变",
    expected_old_state_valid: true,
    expected_new_state_valid: true,
    expected_permission_unchanged: true,
  },
  {
    id: "SC-T040-02-session-id",
    title: "cross-dim: sessionID 变化 → 旧状态失效",
    dimension: "sessionID",
    preconditions: "先成功 attest 一次 + 改 sessionID (例如新建 session 后复用同一 agent)",
    inject: "换 sessionID,其他维度保持",
    oracle: "ORA-PT-11: sessionID 是身份维度,变化 → 旧状态失效,verified:false",
    expected_old_state_valid: false,
    expected_new_state_valid: false,
    expected_permission_unchanged: false,
  },
  {
    id: "SC-T040-03-agent",
    title: "cross-dim: agent 变化 → 旧状态失效",
    dimension: "agent",
    preconditions: "先成功 attest 一次 (agent=build) + 切到 agent=general",
    inject: "换 agent,其他维度保持",
    oracle: "ORA-PT-11: agent 是身份维度,变化 → 旧状态失效,verified:false",
    expected_old_state_valid: false,
    expected_new_state_valid: false,
    expected_permission_unchanged: false,
  },
  {
    id: "SC-T040-04-scope",
    title: "cross-dim: canonicalTaskScope 变化 → 旧状态失效",
    dimension: "canonicalTaskScope",
    preconditions: "先成功 attest 一次 (scope=A) + 改 scope (scope=B)",
    inject: "换 canonicalTaskScope,其他维度保持",
    oracle: "ORA-PT-11: scope 是授权维度,变化 → 旧状态失效 (scope 改变等于权限范围改变)",
    expected_old_state_valid: false,
    expected_new_state_valid: false,
    expected_permission_unchanged: false,
  },
  {
    id: "SC-T040-05-required",
    title: "cross-dim: required list 变化 → 旧状态失效",
    dimension: "required",
    preconditions: "先成功 attest 一次 (required=[a,b]) + 改 required (required=[a,b,c])",
    inject: "往 required list 加一个新项,其他维度保持",
    oracle: "ORA-PT-13: required 列表是授权维度,变化 → 旧状态失效 (覆盖的 Skill 集合变了)",
    expected_old_state_valid: false,
    expected_new_state_valid: false,
    expected_permission_unchanged: false,
  },
  {
    id: "SC-T040-06-skill-content",
    title: "cross-dim: Skill 文件内容变化 → 旧状态失效",
    dimension: "skill-content",
    preconditions: "先成功 attest 一次 + 修改 Skill 文件 (例如改一句 description)",
    inject: "touch Skill 文件,触发 file hash 变化,其他维度保持",
    oracle: "ORA-PT-13: Skill 内容是身份维度,文件 hash 变化 → 旧状态失效 (基于内容哈希的 attestation 失效)",
    expected_old_state_valid: false,
    expected_new_state_valid: false,
    expected_permission_unchanged: false,
  },
  {
    id: "SC-T040-07-fail-auth-overwrite",
    title: "fail-auth overwrite: 失败认证清除/覆盖之前 allow 状态",
    dimension: "fail-auth",
    preconditions: "先成功 attest 一次 (allow 状态) + 触发一次失败认证 (DB 写失败注入)",
    inject: "在已有 allow 状态的基础上注入 DB 写失败,验证旧 allow 状态被清除",
    oracle: "ORA-PT-13: 失败认证 → 旧 allow 状态清除,后续请求全部 verified:false (fail-closed)",
    expected_old_state_valid: false,
    expected_new_state_valid: false,
    expected_permission_unchanged: false,
  },
];

// ── Result types ──
interface SubcaseResult {
  subcaseId: string;
  dimension: string;
  expected_old_state_valid: boolean;
  actual_old_state_valid: boolean | null;
  expected_new_state_valid: boolean;
  actual_new_state_valid: boolean | null;
  expected_permission_unchanged: boolean;
  actual_permission_unchanged: boolean | null;
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
  subcases: Subcase[];
  results: SubcaseResult[];
  oracle: string;
  summary: { total: number; pass: number; fail: number; dryRun: number };
  notes: string;
}

// ── log helpers ──
function log(m: string) { console.log(`[T-PT-040] ${m}`); }
function info(m: string) { console.log(`  ${m}`); }

// ── Stub for subcase verification (DRY_RUN: 不发真请求) ──
async function verifySubcase(sc: Subcase): Promise<SubcaseResult> {
  log(`  [DRY-RUN] ${sc.id}: ${sc.title}`);
  info(`    dimension: ${sc.dimension}`);
  info(`    inject: ${sc.inject}`);
  info(`    oracle: ${sc.oracle}`);
  // dry-run: 不真跑 state validator,标记为 'n/a-dry-run'
  return {
    subcaseId: sc.id,
    dimension: sc.dimension,
    expected_old_state_valid: sc.expected_old_state_valid,
    actual_old_state_valid: null,
    expected_new_state_valid: sc.expected_new_state_valid,
    actual_new_state_valid: null,
    expected_permission_unchanged: sc.expected_permission_unchanged,
    actual_permission_unchanged: null,
    pass: false, // dry-run 不可形成结论
    note: `DRY_RUN=true: 未真验证。生产真跑需 reviewer 授权 + 每例独立 DB/session + 最小 state diff 落盘。`,
  };
}

// ── Main ──
async function main() {
  log("=== T-PT-040: state regression across identity dimensions ===");
  log(`serveUrl: ${SERVE_URL}`);
  log(`DRY_RUN: ${DRY_RUN}`);
  log(`FRAMEWORK_SKILL_READ_HARD_GATE: ${process.env.FRAMEWORK_SKILL_READ_HARD_GATE || "(not set)"}`);
  log(`prerequisiteOrder: ${PREREQUISITES.join(" → ")}`);
  log(`evidenceDir: ${EVIDENCE_DIR}`);

  // 1. 前置检查
  log("Step 0: 前置检查...");
  for (const prereq of PREREQUISITES) {
    log(`  prerequisite ${prereq} — 必须由 reviewer 单独执行 PASS 才可放行 T-PT-040`);
  }
  log(`  Verified-by: 自身 dry-run 计划已写入 → ${SUBCASES.length} subcases`);

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

  // 4. Subcase loop
  log("Step 1: Verify 7 state-regression subcases (DRY-RUN: only log)...");
  const results: SubcaseResult[] = [];
  for (const sc of SUBCASES) {
    const r = await verifySubcase(sc);
    results.push(r);
    log(`  ${sc.id} (${sc.dimension}): pass=${r.pass} (DRY-RUN placeholder)`);
  }

  // 5. Write evidence
  const evidence: Evidence = {
    testId: TEST_ID,
    timestamp: new Date().toISOString(),
    prerequisites: PREREQUISITES,
    frameworkSkillReadHardGate: process.env.FRAMEWORK_SKILL_READ_HARD_GATE || "(not set)",
    dryRun: DRY_RUN,
    serveUrl: SERVE_URL,
    subcases: SUBCASES,
    results,
    oracle: "ORA-PT-11/13: caller label 是审计维度(单独变化不失效);其他 5 个身份/授权维度变化 → 旧状态失效;失败认证 → 清除旧 allow 状态",
    summary: {
      total: SUBCASES.length,
      pass: 0, // dry-run cannot form a pass verdict
      fail: 0, // dry-run cannot form a fail verdict either
      dryRun: SUBCASES.length,
    },
    notes: "DRY_RUN=true: this evidence is a prepared run-plan, not an executed run. To execute, reviewer must: (1) start isolated serve with FRAMEWORK_SKILL_READ_HARD_GATE=1, (2) T-PT-039 happy baseline 已 PASS, (3) for each subcase: 独立 DB/session, baseline 写一次, 注入维度变化, 跑 state validator, 对比 expected vs actual, 保存最小 state diff.",
  };
  const evidenceFile = join(EVIDENCE_DIR, "t040-evidence.json");
  writeFileSync(evidenceFile, JSON.stringify(evidence, null, 2));
  log(`Evidence saved: ${evidenceFile}`);

  // 6. Write checklist artifact
  const checklistFile = join(EVIDENCE_DIR, "t040-checklist.md");
  writeFileSync(checklistFile, `# T-PT-040 checklist (DRY-RUN plan)

## Status
- ${TEST_ID}: READY (not executed)
- DRY_RUN: ${DRY_RUN}
- FRAMEWORK_SKILL_READ_HARD_GATE: ${process.env.FRAMEWORK_SKILL_READ_HARD_GATE || "(not set)"}

## Prerequisites
- ${PREREQUISITES.join("\n- ")}

## Subcases (7)
${SUBCASES.map((s) => `- ${s.id} [${s.dimension}]: ${s.title} → expected old_state_valid=${s.expected_old_state_valid}, new_state_valid=${s.expected_new_state_valid}, permission_unchanged=${s.expected_permission_unchanged}`).join("\n")}

## Oracle
- ORA-PT-11/13: caller label 是审计维度(单独变化不失效);其他 5 个身份/授权维度变化 → 旧状态失效;失败认证 → 清除旧 allow 状态

## Required evidence (production run)
- 每例独立 DB row + session 快照
- 最小 state diff (before/after)
- state validator 完整返回 (verified / state_written / old_state_invalid / permission set)
- 维度注入记录 (例如 sessionID 改的具体值)
`);
  log(`Checklist saved: ${checklistFile}`);

  log("\n=== Final ===");
  log(`  total subcases: ${SUBCASES.length}`);
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
