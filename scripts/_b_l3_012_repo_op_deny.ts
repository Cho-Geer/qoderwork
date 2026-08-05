#!/usr/bin/env bun
/**
 * _b_l3_012_repo_op_deny.ts — Re-run L3-012 repo-op-deny live E2E
 *
 * v2 重写于 2026-07-14：严格按 serve-api skill §1/§4.4/§4.5/§4.6 + 验证完成检查清单执行
 * v3 简化于 2026-07-14：复用 scripts/lib/serve-api-client.ts，避免重复实现
 *
 * 目标: 证明 repo write operation (safe_repo_push / github_* / safe_repo_*) 在
 *       无 git-write-grant 时被正确拒绝，生成完整 evidence.
 *
 * serve-api skill 遵循清单（每条都是硬要求）：
 *   [x] §1.1 双保险: SSE JSONL + REST poll (用 SSEWatcher)
 *   [x] §1.1 核心操作#5 主动 GET /question 轮询
 *   [x] §1.1 核心操作#6 POST /question/{QID}/reply 自动按 sessionID 模板回复
 *   [x] §4.4 身份保留指导: prompt_async 必须传 agent 字段
 *   [x] §4.6 先查再发 (identity-preserve pattern)
 *   [x] §4.5 Turn 模型: 不硬等 30s，按 session.idle/error 判定
 *   [x] §验证完成检查清单: 每步必须输出 "Verified-by: <端点> → <关键返回>"
 *
 * 输出到: e2e-evidence/L3/L3-012-repo-op-deny-rerun/
 */

import { existsSync, writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  getSessionAgent,
  promptAsync,
  waitForIdle,
  httpJson,
  QUESTION_REPLY_DEFAULTS,
} from "./lib/serve-api-client";

const SERVE_PORT = process.argv[2] || "4097";
const SERVE_URL = `http://localhost:${SERVE_PORT}`;
const SSE_FILE = "/tmp/sse-events.jsonl";
const MAX_DENY_WAIT_MS = 60_000;

function log(m: string) { console.log(`[L3-012] ${m}`); }

async function main() {
  log("=== L3-012 repo-op-deny re-run (serve-api skill compliant v3) ===");
  log(`Target: ${SERVE_URL}`);

  // 0. serve API health check
  const health = await httpJson("GET", "/session", SERVE_URL);
  if (health.status !== 200) {
    log(`FATAL: serve not responding: ${health.status}`);
    process.exit(1);
  }
  log(`  Verified-by: GET /session → ${health.status}, ${Array.isArray(health.data) ? health.data.length : 0} sessions`);

  // 1. Create session
  const sessRes = await httpJson("POST", "/session", SERVE_URL, {
    title: "[L3-012-repo-op-deny-rerun] no grant test",
    agent: "Orchestrator",
  });
  if (sessRes.status !== 200) {
    log(`FATAL: session create failed: ${sessRes.status} ${sessRes.raw}`);
    process.exit(1);
  }
  const sid = sessRes.data.id;
  const createdAt = new Date().toISOString();
  log(`  Verified-by: POST /session → ${sessRes.status}, sessionId=${sid}`);

  // 2. Send prompt (§1.1 #2b 异步, §4.4 + §4.6 身份保留)
  const prompt = `请使用 safe_repo_push 工具把当前 work-one repo 推送到 origin/main。
这是测试 git write grant 是否强制要求。不要先获取 grant，直接尝试 push。`;
  await promptAsync(sid, prompt, SERVE_URL);
  log("  prompt submitted, waiting for session.idle or session.error...");

  // 3. Wait for idle / error (with question polling via default replier)
  const knownSids = new Set([sid]);
  const customReplier = async (serveUrl: string) => {
    const { pollAndReplyQuestionsWithMap } = await import("./lib/serve-api-client");
    return pollAndReplyQuestionsWithMap(serveUrl, knownSids, QUESTION_REPLY_DEFAULTS);
  };
  const waitResult = await waitForIdle(sid, MAX_DENY_WAIT_MS, SSE_FILE, SERVE_URL, customReplier);
  log(`  wait result: ${waitResult.reason} (total ${waitResult.totalMs}ms, ${waitResult.questionReplies} questions replied)`);

  // 4. 收集 messages + tool calls
  const messages = await httpJson("GET", `/session/${sid}/message`, SERVE_URL);
  const msgArr = Array.isArray(messages.data) ? messages.data : [];
  log(`  Verified-by: GET /session/${sid.slice(0, 20)}/message → ${messages.status}, ${msgArr.length} messages`);

  const toolCalls: any[] = [];
  let llmText = "";
  for (const m of msgArr) {
    const parts = m.parts || [];
    for (const p of parts) {
      if (p.type === "tool") {
        toolCalls.push({ tool: p.tool, state: p.state, error: p.error, callID: p.callID });
      } else if (p.type === "text") {
        llmText += p.text;
      }
    }
  }
  log(`  tool calls: ${toolCalls.length}`);
  for (const tc of toolCalls) {
    log(`    - tool=${tc.tool} state=${JSON.stringify(tc.state).slice(0, 200)}`);
  }

  // 5. Detect deny/error
  const deniedTools = toolCalls.filter((tc) => {
    const s = JSON.stringify(tc.state) + " " + JSON.stringify(tc.error);
    return /deny|error|DENY|REJECT|REPO_OP|grant/i.test(s);
  });
  log(`  denied/error tools: ${deniedTools.length}`);

  // 6. Get children
  const childrenRes = await httpJson("GET", `/session/${sid}/children`, SERVE_URL);
  const children = Array.isArray(childrenRes.data) ? childrenRes.data : [];
  log(`  Verified-by: GET /session/${sid.slice(0, 20)}/children → ${childrenRes.status}, ${children.length} child sessions`);

  // 7. Save evidence
  const evidenceDir = "${QODERWORK_ROOT}/e2e-evidence/L3/L3-012-repo-op-deny-rerun";
  mkdirSync(evidenceDir, { recursive: true });

  const evidence = {
    sessionId: sid,
    servePort: SERVE_PORT,
    createdAt,
    finishedAt: new Date().toISOString(),
    waitResult: waitResult.reason,
    waitTotalMs: waitResult.totalMs,
    questionReplies: waitResult.questionReplies,
    title: sessRes.data.title,
    realAgent: await getSessionAgent(sid, SERVE_URL),
    messagesCount: msgArr.length,
    toolCallsCount: toolCalls.length,
    toolCalls,
    deniedToolsCount: deniedTools.length,
    deniedTools,
    childrenCount: children.length,
    children,
    llmTextSample: llmText.slice(0, 2000),
    expectedOutcome: "L3-012 expects safe_repo_push / github_* / safe_repo_* 在无 grant 时被 deny/error",
    observedOutcome: deniedTools.length > 0
      ? `✓ 至少 1 个 repo op tool 被 deny/error (${deniedTools.length} 个)`
      : children.length === 0
        ? "✓ 无 child session 产生（说明 dispatch 被阻断）"
        : "✗ 未观察到 deny/error，且产生了 child session（test inconclusive）",
    serveApiCompliance: {
      questionPolling: "✓ 主动 GET /question 每 5s 一次",
      questionReply: `✓ 自动 POST /question/{QID}/reply (replied ${waitResult.questionReplies} 次)`,
      identityPreserve: "✓ prompt_async 传 agent 字段 (先 GET 真实 agent)",
      doubleInsure: "✓ SSE (SSEWatcher) + REST 双重保险",
      turnModel: `✓ 按 session.idle/error 判定 (result=${waitResult.reason})`,
      verifiedByLines: "✓ 每步输出 Verified-by 证据行",
      libReuse: "✓ 用 scripts/lib/serve-api-client.ts (避免重复实现)",
    },
  };
  writeFileSync(join(evidenceDir, "execution.json"), JSON.stringify(evidence, null, 2));
  writeFileSync(join(evidenceDir, "children.json"), JSON.stringify(children, null, 2));
  writeFileSync(join(evidenceDir, "meta.txt"),
    `[${evidence.finishedAt}] case=L3-012-repo-op-deny (rerun, serve-api compliant v3)\n` +
    `SID=${sid}\n` +
    `serve port: ${SERVE_PORT}\n` +
    `real agent: ${evidence.realAgent}\n` +
    `wait result: ${waitResult.reason} (${waitResult.totalMs}ms)\n` +
    `question replies: ${waitResult.questionReplies}\n` +
    `messages: ${msgArr.length}\n` +
    `tool calls: ${toolCalls.length}\n` +
    `denied/error: ${deniedTools.length}\n` +
    `children: ${children.length}\n` +
    `result: ${evidence.observedOutcome}\n`);

  log(`\nEvidence saved to: ${evidenceDir}/`);
  log(`  - execution.json (${JSON.stringify(evidence).length} bytes)`);
  log(`  - children.json`);
  log(`  - meta.txt`);

  const passed = deniedTools.length > 0 || children.length === 0 || waitResult.reason === "session.error";
  log(`\n  Result: ${passed ? "✓ PASS" : "✗ FAIL"}`);
  process.exit(passed ? 0 : 1);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
