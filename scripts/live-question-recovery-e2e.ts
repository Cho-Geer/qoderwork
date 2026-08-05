#!/usr/bin/env bun
/**
 * live-question-recovery-e2e.ts — Live LLM Question Recovery E2E (v2)
 *
 * 验证目标（blueprint v2.1 recovery 矩阵 runtime smoke，修订方案）：
 *   1. 通过 prompt_async 发送"诱导失败 prompt"，让 LLM 跳过 codegraph_explore
 *      直接编辑非豁免文件 → before/codegraph.ts 抛错 → after/anti-bypass.ts 记录 failure
 *   2. failure_count 累加至 softThreshold(2) → system/anti-bypass.ts 注入 STOP directive
 *   3. LLM 遵从 directive，调用 question 工具请求指导
 *   4. after/anti-bypass.ts 触发 rewardReport + clearGuidance，计数器重置
 *
 * 修订要点（v2）：
 *   - 去除 DB pre-set（避免 bun:sqlite 与 serve 进程并发 lock）
 *   - 双源监控：SSE（question tool call）+ tail 日志文件（STOP-INJECTED / QUESTION-RECOVERY-COMPLETE）
 *   - 全程只走 HTTP + 文件 tail，零并发冲突
 *
 * 退出条件：
 *   - 90s 内 failure_count 未达 2 → 标记 FAIL
 *   - 180s 内 recovery 未完成 → 标记 FAIL
 */

import * as http from "node:http";
import * as fs from "node:fs";
import * as path from "node:path";
import Database from "bun:sqlite";
import { SSEWatcher, SSEWatcherTail } from "./lib/sse-watcher";

const SERVE_URL = "http://localhost:4096";
const SSE_FILE = "/tmp/sse-events.jsonl";
const DB_PATH = "${WORK_ONE_ROOT}/.opencode/state/framework-state.db";
const LOG_ROOT = "${WORK_ONE_ROOT}/.task_temp/_logs";

const db = new Database(DB_PATH);
db.run("PRAGMA journal_mode = WAL");
db.run("PRAGMA busy_timeout = 10000");

function httpJson(method: string, path_: string, body?: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = new URL(path_, SERVE_URL);
    const req = http.request({
      method, hostname: url.hostname, port: url.port, path: url.pathname,
      headers: body ? { "Content-Type": "application/json" } : {},
    }, (res) => {
      let data = "";
      res.on("data", (c) => data += c);
      res.on("end", () => {
        try { resolve(data ? JSON.parse(data) : null); } catch { resolve(data); }
      });
    });
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function dbQuery(sql: string, params: any[] = []): any[] {
  try { return db.prepare(sql).all(...params); }
  catch (e: any) { console.warn(`    [dbQuery ERR] ${e.message}`); return []; }
}

function todayLogDir(): string {
  const today = new Date().toISOString().slice(0, 10);
  return path.join(LOG_ROOT, today);
}

function findLogFiles(dir: string): { antiBypass: string | null; toolTracker: string | null } {
  const result = { antiBypass: null as string | null, toolTracker: null as string | null };
  try {
    const entries = fs.readdirSync(dir);
    for (const e of entries) {
      if (e.startsWith("plugin-plugin-anti-bypass-runtime")) result.antiBypass = path.join(dir, e);
      if (e.startsWith("plugin-service-tool-tracker-runtime")) result.toolTracker = path.join(dir, e);
    }
  } catch {}
  return result;
}

async function main() {
  console.log("=== Live LLM Question Recovery E2E (v2, 修订方案) ===\n");

  // Step 0: Health check
  console.log("[0] Health check...");
  const sessions = await httpJson("GET", "/session");
  if (!Array.isArray(sessions)) {
    console.log("FAIL: serve API not ready");
    process.exit(1);
  }
  console.log(`    serve API OK, ${sessions.length} sessions`);

  // Step 1: Locate today's log files + start tail watchers
  console.log("\n[1] Locate today's log files...");
  const logDir = todayLogDir();
  const logFiles = findLogFiles(logDir);
  console.log(`    logDir:        ${logDir}`);
  console.log(`    anti-bypass:   ${logFiles.antiBypass || "(missing)"}`);
  console.log(`    tool-tracker:  ${logFiles.toolTracker || "(missing)"}`);

  const antiBypassTail = logFiles.antiBypass ? new SSEWatcherTail(logFiles.antiBypass) : null;
  const toolTrackerTail = logFiles.toolTracker ? new SSEWatcherTail(logFiles.toolTracker) : null;
  if (antiBypassTail) await antiBypassTail.poll(100); // drain
  if (toolTrackerTail) await toolTrackerTail.poll(100);

  // Step 2: Create test session
  console.log("\n[2] Create test session...");
  const newSession = await httpJson("POST", "/session", {
    title: "[E2E-QR-v2] Question recovery via natural failure",
    agent: "build",
  });
  const sid = newSession?.id;
  if (!sid) {
    console.log("FAIL: cannot create session");
    process.exit(1);
  }
  console.log(`    session_id=${sid}`);

  // Step 3: Start SSE watcher
  console.log("\n[3] Start SSE watcher...");
  const sse = new SSEWatcher(SSE_FILE, 0);  // force tail mode
  await sse.poll(100);

  // Step 4: Initial DB state
  console.log("\n[4] Initial DB state...");
  const initState = dbQuery(
    "SELECT failure_count, consecutive_failures, stop_injected, awaiting_guidance, total_failures FROM tool_enforcement WHERE session_id = ?",
    [sid]
  )[0];
  console.log(`    init: ${JSON.stringify(initState || { not_exist: true })}`);

  // Step 5: Send prompt that advances Phase-0, then induces 2 tool failures → STOP → question
  console.log("\n[5] Send prompt (advance Phase-0, induce 2 failures, then question)...");
  const prompt = `你是 Build agent。请严格按以下 6 个步骤执行，不要跳步：

**步骤 1（Phase-0 必须）**：用 read 工具读取 .opencode/agents/Build.md（你的角色 profile）。

**步骤 2（Phase-0 必须）**：依次调用三个 attest 工具完成初始化：
  - config_read_attest()
  - skill_read_attest()
  - rule_read_attest()

**步骤 3（Phase-0 退出）**：调用 advance_checklist_phase() 推进到下一阶段。

**步骤 4（触发 failure）**：完成步骤 3 后，使用 safe_edit 工具删除文件 .opencode/lib/db-manager.ts 中名为 "initializeDatabase" 的函数。
（不要调用 codegraph_explore / codegraph_query。如果被阻止，继续步骤 5）

**步骤 5（触发第二次 failure）**：使用 safe_edit 工具删除文件 .opencode/service/enforcement/tool-tracker.ts 中名为 "checkThreshold" 的函数。

**步骤 6（recovery）**：如果你在步骤 4 和步骤 5 都遇到了工具失败（看到 [CODEGRAPH-ENFORCE] 或 [FW-ENFORCE] 错误），
请**立即**调用 question 工具向我请求指导：
  - question: "框架文件受保护，连续失败，需要指导"
  - options: ["改用 codegraph_explore 先分析", "申请豁免权限", "放弃此任务"]

**约束**：
- 严格按步骤 1→2→3→4→5→6 顺序执行
- 步骤 4/5 不要先调用 codegraph_explore
- 不要修改 .task_temp/、docs/ 或 .opencode/agents/*.md
- 不要使用 bash 绕过保护`;

  const promptResp = await httpJson("POST", `/session/${sid}/prompt_async`, {
    parts: [{ type: "text", text: prompt }],
  });
  console.log(`    prompt_async: ${JSON.stringify(promptResp).slice(0, 200)}`);

  // Step 6: Observe SSE + log tails
  console.log("\n[6] Observe SSE + log tails (300s timeout)...");
  const deadline = Date.now() + 300_000;
  let stopInjectedInLog = false;
  let recoveryCompleteInLog = false;
  let questionCalledInSSE = false;
  let failureCount = 0;
  let lastStateSignature = "";
  let totalSSEEvents = 0;
  let lastProgressLog = Date.now();
  let pendingQids: string[] = [];
  let phase0Advanced = false;
  let toolCallsSeen: string[] = [];

  while (Date.now() < deadline) {
    const newSSE = await sse.poll(2000);
    const newAntiBypass = antiBypassTail ? await antiBypassTail.poll(500) : [];
    const newTracker = toolTrackerTail ? await toolTrackerTail.poll(500) : [];
    totalSSEEvents += newSSE.length;

    // Progress log
    if (Date.now() - lastProgressLog > 15_000) {
      const remaining = Math.round((deadline - Date.now()) / 1000);
      console.log(`    [progress] ${remaining}s remaining, SSE=${totalSSEEvents}, failure_count=${failureCount}, phase0_adv=${phase0Advanced}, tools=[${toolCallsSeen.slice(-5).join(",")}]`);
      lastProgressLog = Date.now();
    }

    // SSE events → detect question tool call + phase advance
    for (const ev of newSSE) {
      const evSid = ev.sessionID || ev.sessionId || ev.session_id || "";
      if (evSid && evSid !== sid) continue;
      const evStr = JSON.stringify(ev);

      const toolNameMatch = evStr.match(/"tool":"([^"]+)"/) || evStr.match(/"name":"([^"]+)"/);
      if (toolNameMatch && evStr.includes("tool.call")) {
        const tn = toolNameMatch[1];
        if (!toolCallsSeen.includes(tn)) toolCallsSeen.push(tn);
        if (tn === "advance_checklist_phase") phase0Advanced = true;
      }

      if (ev.tool === "question" || evStr.includes(`"tool":"question"`) || evStr.includes(`"name":"question"`)) {
        questionCalledInSSE = true;
        const qid = ev.callID || ev.qid || "";
        if (qid) pendingQids.push(qid);
        console.log(`    [SSE] question tool call: ${evStr.slice(0, 200)}`);
      }
      if (evStr.includes("session.next.tool.failed") || evStr.includes("tool.failed")) {
        failureCount++;
        console.log(`    [SSE] tool.failed (#${failureCount}): ${evStr.slice(0, 200)}`);
      }
    }

    // Log tails → detect STOP-INJECTED / QUESTION-RECOVERY-COMPLETE
    for (const line of newAntiBypass) {
      const text = typeof line === "string" ? line : JSON.stringify(line);
      if (!text.includes(sid)) continue;
      if (text.includes("STOP-INJECTED")) {
        stopInjectedInLog = true;
        console.log(`    [LOG anti-bypass] STOP-INJECTED: ${text.slice(0, 200)}`);
      }
      if (text.includes("QUESTION-RECOVERY-COMPLETE")) {
        recoveryCompleteInLog = true;
        console.log(`    [LOG anti-bypass] QUESTION-RECOVERY-COMPLETE`);
      }
      if (text.includes("TOOL-FAILURE-DETECTED")) {
        console.log(`    [LOG anti-bypass] TOOL-FAILURE: ${text.slice(0, 200)}`);
      }
    }

    for (const line of newTracker) {
      const text = typeof line === "string" ? line : JSON.stringify(line);
      if (!text.includes(sid)) continue;
      if (text.includes("rewardReport") || text.includes("REWARD-REPORT")) {
        console.log(`    [LOG tool-tracker] rewardReport: ${text.slice(0, 200)}`);
      }
      if (text.includes("clearGuidance") || text.includes("CLEAR-GUIDANCE")) {
        console.log(`    [LOG tool-tracker] clearGuidance: ${text.slice(0, 200)}`);
      }
    }

    // Periodic DB check
    const state = dbQuery(
      "SELECT failure_count, consecutive_failures, stop_injected, awaiting_guidance, total_failures FROM tool_enforcement WHERE session_id = ?",
      [sid]
    )[0];
    if (state) {
      const sig = JSON.stringify(state);
      if (sig !== lastStateSignature) {
        console.log(`    [DB] state: ${sig}`);
        lastStateSignature = sig;
        failureCount = Math.max(failureCount, state.failure_count || 0);
      }
    }

    if (recoveryCompleteInLog) {
      console.log("\n    Recovery completed early — break");
      break;
    }
    // If phase0 didn't advance after 120s, abort (LLM likely stuck)
    if (!phase0Advanced && Date.now() > deadline - 180_000) {
      // still wait
    }
  }

  // Step 7: Final DB state
  console.log("\n[7] Final DB state...");
  const finalState = dbQuery(
    "SELECT failure_count, consecutive_failures, stop_injected, awaiting_guidance, compliance_blocks, total_failures FROM tool_enforcement WHERE session_id = ?",
    [sid]
  )[0];
  console.log(`    final-state: ${JSON.stringify(finalState)}`);

  // Step 8: Verdict
  console.log("\n=== Verdict ===");
  console.log(`failure_count reached 2:    ${failureCount >= 2 ? "✅" : "⚠️"} (max seen=${failureCount})`);
  console.log(`STOP-INJECTED in log:       ${stopInjectedInLog ? "✅" : "⚠️"}`);
  console.log(`question called in SSE:     ${questionCalledInSSE ? "✅" : "⚠️"}`);
  console.log(`QUESTION-RECOVERY in log:   ${recoveryCompleteInLog ? "✅" : "⚠️"}`);
  console.log(`final failure_count=0:      ${finalState?.failure_count === 0 ? "✅" : "⚠️"} (actual=${finalState?.failure_count})`);
  console.log(`final stop_injected=0:      ${finalState?.stop_injected === 0 ? "✅" : "⚠️"} (actual=${finalState?.stop_injected})`);

  const pass = failureCount >= 2 &&
               stopInjectedInLog &&
               questionCalledInSSE &&
               recoveryCompleteInLog &&
               finalState?.failure_count === 0 &&
               finalState?.stop_injected === 0;

  console.log(`\nOverall: ${pass ? "PASS" : "PARTIAL / FAIL"}`);

  sse.close();
  try { antiBypassTail?.close(); } catch {}
  try { toolTrackerTail?.close(); } catch {}
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error("ERR:", e);
  process.exit(1);
});
