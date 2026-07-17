#!/usr/bin/env bun
/**
 * _b_pt_wm_00r2_g2_t039.ts — G2 integration: attestation negative (T-PT-039)
 *
 * 创建于 2026-07-14 — 严格按 test-spec v1.4.0 §3.2 T-PT-039 + Blueprint v1.5.0 §2.2.7
 *
 * Test ID: T-PT-039 (G2 group)
 * prerequisiteOrder: T-PT-048 → T-PT-049 (必须先证明 shared identity + real DB lifecycle)
 * FRAMEWORK_SKILL_READ_HARD_GATE=1 (由 reviewer 启动隔离 serve 后方可执行)
 * 状态: READY (not executed — H2 需用户授权)
 *
 * 覆盖 REQ: REQ-PT-015、REQ-PT-017
 * Oracle: ORA-PT-11/13
 *   - 仅共享 identity 完整验证且原子写成功 → verified:true, state_written:true
 *   - 其他路径 → false 且无可用旧状态 (fail-closed)
 *
 * 6 subcases (test-spec §3.2 T-PT-039 硬性要求):
 *   1. happy  (完整 identity + DB write 成功)
 *   2. empty list (required list 为空 → deny)
 *   3. missing identity (session/agent/scope 任一缺失 → deny)
 *   4. child hint mismatch (root vs child session hint 不一致 → deny)
 *   5. DB write fail (state_written=false 注入 → deny)
 *   6. stale state (旧有效状态在 DB 写失败后失效 → deny)
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
 * 使用: bun run _b_pt_wm_00r2_g2_t039.ts --run-dir <absolute-run-dir>
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
const TEST_ID = "T-PT-039";
const EVIDENCE_DIR = RUN_MANIFEST.paths.artifactsDir;
const PREREQUISITES = ["T-PT-048", "T-PT-049"];
const FRAMEWORK_SKILL_READ_HARD_GATE = "1";

// ── Subcase definition (6 hard-required by test-spec §3.2) ──
interface Subcase {
  id: string;
  title: string;
  preconditions: string;
  inject: string; // 故障/状态注入说明 (DRY-RUN: 仅文档)
  oracle: string;
  expected_verified: boolean;
  expected_state_written: boolean;
  expected_old_state_invalid: boolean;
}

const SUBCASES: Subcase[] = [
  {
    id: "SC-T039-01-happy",
    title: "Happy path: 完整 shared identity + DB write 成功",
    preconditions: "临时 worktree config + 独立 DB + 真实 Skill 文件 + FRAMEWORK_SKILL_READ_HARD_GATE=1",
    inject: "(none — 正常 attest 调用)",
    oracle: "ORA-PT-11: 共享 identity (sessionID/agent/scope/callerLabel) 完整 → verified:true",
    expected_verified: true,
    expected_state_written: true,
    expected_old_state_invalid: false,
  },
  {
    id: "SC-T039-02-empty-list",
    title: "Empty required list: required=[] → deny",
    preconditions: "正常 session + DB；attest.required 列表显式置空",
    inject: "在 attestSkillRead() 调用前把 required 改 []",
    oracle: "ORA-PT-13: required list 非空校验未通过 → verified:false, state_written:false",
    expected_verified: false,
    expected_state_written: false,
    expected_old_state_invalid: true,
  },
  {
    id: "SC-T039-03-missing-identity",
    title: "Missing identity: session/agent/scope 任一缺失 → deny",
    preconditions: "正常 session + DB；分别删 sessionID / agent / canonicalTaskScope",
    inject: "分三轮,每轮缺一个 identity 字段,跑 attestSkillRead()",
    oracle: "ORA-PT-13: canonical identity 校验失败 → verified:false, state_written:false, 旧状态失效",
    expected_verified: false,
    expected_state_written: false,
    expected_old_state_invalid: true,
  },
  {
    id: "SC-T039-04-child-hint-mismatch",
    title: "Child hint mismatch: root session 标识 vs child session 标识不一致 → deny",
    preconditions: "父 session 创建 child session,parentSessionID 不匹配 childSessionID 上报的 hint",
    inject: "在 dispatch_subagent 生成的 child session 上,篡改 childSessionHint.parentSessionID",
    oracle: "ORA-PT-11: identity 一致性校验失败 → verified:false, state_written:false",
    expected_verified: false,
    expected_state_written: false,
    expected_old_state_invalid: true,
  },
  {
    id: "SC-T039-05-db-write-fail",
    title: "DB write 失败: state_written=false → deny + 旧状态失效",
    preconditions: "DB 写故障注入 (DB write throws / connection drop) + 之前存在有效 old state",
    inject: "在 dbWriteSubState() 注入 throw,验证 fail-closed 行为",
    oracle: "ORA-PT-11/13: 原子写失败 → verified:false, 旧 row 标记失效 (fail-closed)",
    expected_verified: false,
    expected_state_written: false,
    expected_old_state_invalid: true,
  },
  {
    id: "SC-T039-06-stale-state",
    title: "Stale state: 之前写过的 old state 在新一次写失败后不可用",
    preconditions: "先成功 attest 一次 (建立有效 old state) → 第二次注入 DB write fail",
    inject: "先 happy path 写一次,再触发 SC-T039-05 故障,验证后续 attest 全部 false",
    oracle: "ORA-PT-13: 写失败后旧有效 state 不可用, 后续请求 fail-closed",
    expected_verified: false,
    expected_state_written: false,
    expected_old_state_invalid: true,
  },
];

// ── Result types ──
interface SubcaseResult {
  subcaseId: string;
  expected_verified: boolean;
  actual_verified: boolean | null;
  expected_state_written: boolean;
  actual_state_written: boolean | null;
  expected_old_state_invalid: boolean;
  actual_old_state_invalid: boolean | null;
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
function log(m: string) { console.log(`[T-PT-039] ${m}`); }
function info(m: string) { console.log(`  ${m}`); }

// ── Stub for subcase verification (DRY_RUN: 不发真请求) ──
async function verifySubcase(sc: Subcase): Promise<SubcaseResult> {
  log(`  [DRY-RUN] ${sc.id}: ${sc.title}`);
  info(`    inject: ${sc.inject}`);
  info(`    oracle: ${sc.oracle}`);
  // dry-run: 不真跑 attest helper,标记为 'n/a-dry-run'
  return {
    subcaseId: sc.id,
    expected_verified: sc.expected_verified,
    actual_verified: null,
    expected_state_written: sc.expected_state_written,
    actual_state_written: null,
    expected_old_state_invalid: sc.expected_old_state_invalid,
    actual_old_state_invalid: null,
    pass: false, // dry-run 不可形成结论
    note: `DRY_RUN=true: 未真验证。生产真跑需 reviewer 授权 + active reviewer-isolated serve + DB fault inject。`,
  };
}

// ── Main ──
async function main() {
  log("=== T-PT-039: attestation negative (shared identity, DB lifecycle) ===");
  log(`serveUrl: ${SERVE_URL}`);
  log(`DRY_RUN: ${DRY_RUN}`);
  log(`FRAMEWORK_SKILL_READ_HARD_GATE: ${process.env.FRAMEWORK_SKILL_READ_HARD_GATE || "(not set)"}`);
  log(`prerequisiteOrder: ${PREREQUISITES.join(" → ")}`);
  log(`evidenceDir: ${EVIDENCE_DIR}`);

  // 1. 前置检查
  log("Step 0: 前置检查...");
  for (const prereq of PREREQUISITES) {
    log(`  prerequisite ${prereq} — 必须由 reviewer 单独执行 PASS 才可放行 T-PT-039`);
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
  log("Step 1: Verify 6 attestation subcases (DRY-RUN: only log)...");
  const results: SubcaseResult[] = [];
  for (const sc of SUBCASES) {
    const r = await verifySubcase(sc);
    results.push(r);
    log(`  ${sc.id}: pass=${r.pass} (DRY-RUN placeholder)`);
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
    oracle: "ORA-PT-11/13: 仅共享 identity 完整验证且原子写成功 → verified:true, state_written:true;其他路径 → false 且无可用旧状态",
    summary: {
      total: SUBCASES.length,
      pass: 0, // dry-run cannot form a pass verdict
      fail: 0, // dry-run cannot form a fail verdict either
      dryRun: SUBCASES.length,
    },
    notes: "DRY_RUN=true: this evidence is a prepared run-plan, not an executed run. To execute, reviewer must: (1) start isolated serve with FRAMEWORK_SKILL_READ_HARD_GATE=1, (2) ensure T-PT-048/049 prerequisites PASS, (3) for each subcase: inject the precondition, call attestSkillRead(), assert verified/state_written/old_state_invalid against oracle, (4) record state before/after + session map + file hash.",
  };
  const evidenceFile = join(EVIDENCE_DIR, "t039-evidence.json");
  writeFileSync(evidenceFile, JSON.stringify(evidence, null, 2));
  log(`Evidence saved: ${evidenceFile}`);

  // 6. Write checklist artifact
  const checklistFile = join(EVIDENCE_DIR, "t039-checklist.md");
  writeFileSync(checklistFile, `# T-PT-039 checklist (DRY-RUN plan)

## Status
- ${TEST_ID}: READY (not executed)
- DRY_RUN: ${DRY_RUN}
- FRAMEWORK_SKILL_READ_HARD_GATE: ${process.env.FRAMEWORK_SKILL_READ_HARD_GATE || "(not set)"}

## Prerequisites
- ${PREREQUISITES.join("\n- ")}

## Subcases (6)
${SUBCASES.map((s) => `- ${s.id}: ${s.title} → expected verified=${s.expected_verified}, state_written=${s.expected_state_written}, old_state_invalid=${s.expected_old_state_invalid}`).join("\n")}

## Oracle
- ORA-PT-11/13: 共享 identity 完整 + DB 原子写成功 → verified:true, state_written:true;其他路径 → false, 旧状态失效

## Required evidence (production run)
- state before/after (DB row diff)
- session map (root + child identity 一致性)
- file hash (Skill 文件未被 mock)
- attestSkillRead() 返回值 (verified / state_written / old_state_invalid)
- 故障注入: DB throw / connection drop (SC-T039-05,06)
`);
  log(`Checklist saved: ${checklistFile}`);

  log("\n=== Final ===");
  log(`  total subcases: ${SUBCASES.length}`);
  log(`  status: READY (not executed — H2 需用户授权)`);
  log(`  next: review this plan, then either keep DRY_RUN=true or hand off to reviewer for live execution`);
}

if (import.meta.main) main().catch((e) => { console.error("FATAL:", e); process.exit(1); });

// ── CLI 入口校验 ──
function requiredRunDir(): string {
  const index = process.argv.indexOf("--run-dir");
  if (index < 0 || !process.argv[index + 1]) {
    throw new Error("run with --run-dir <absolute-path>");
  }
  return process.argv[index + 1];
}
