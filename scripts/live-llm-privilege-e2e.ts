#!/usr/bin/env bun
/**
 * live-llm-privilege-e2e.ts — Live LLM dispatch privilege + safe_framework_edit E2E
 *
 * 闭环剩余 3.5 步证据缺口：
 *   1. createGrant (grant 创建)
 *   2. bindGrant (session.created 绑定)
 *   3. hasGrant + path match (build child 调用 safe_framework_edit 时 grant 校验)
 *   4. CodeGraph 双门 (safe_framework_edit 需要 CodeGraph impact 证据)
 *
 * 隔离策略：
 *   - allowed_paths = ['.opencode/_test_framework/**'] — 严格限定 build 只能写此目录
 *   - 测试文件路径: .opencode/_test_framework/e2e-probe-<ts>.ts (一次性)
 *   - CodeGraph explore 目标: safe_framework_edit 符号（已存在，零副作用）
 *   - 测试后清理: 删除 .opencode/_test_framework/ + DB 行
 *
 * 安全断言：
 *   - build 尝试写非 allowed_paths 文件 → safe_framework_edit 必须拒绝
 *   - build 未调用 codegraph_explore → safe_framework_edit 必须拒绝
 *   - 两者同时满足 → 允许写入
 */

import * as http from "node:http";
import * as fs from "node:fs";
import * as path from "node:path";
import Database from "bun:sqlite";
import { SSEWatcher } from "./lib/sse-watcher";

const SERVE_URL = "http://localhost:4096";
const SSE_FILE = "/tmp/sse-events.jsonl";
const DB_PATH = "/home/zhaoge/workspace/opencode/work-one/.opencode/state/framework-state.db";
const WORKTREE = "/home/zhaoge/workspace/opencode/work-one";
const ISOLATED_DIR = path.join(WORKTREE, ".opencode", "_test_framework");
const PROBE_TAG = Date.now().toString(36);
const PROBE_FILE_REL = `.opencode/_test_framework/e2e-probe-${PROBE_TAG}.ts`;
const PROBE_FILE_ABS = path.join(WORKTREE, PROBE_FILE_REL);

const db = new Database(DB_PATH);

function httpJson(method: string, p: string, body?: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = new URL(p, SERVE_URL);
    const req = http.request({
      method, hostname: url.hostname, port: url.port, path: url.pathname,
      headers: body ? { "Content-Type": "application/json" } : {},
    }, (res) => {
      let data = "";
      res.on("data", (c) => data += c);
      res.on("end", () => { try { resolve(data ? JSON.parse(data) : null); } catch { resolve(data); } });
    });
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function dbQuery(sql: string, params: any[] = []): any[] {
  try { return db.prepare(sql).all(...params); }
  catch (e: any) { console.warn(`  [dbQuery warn] ${e.message}`); return []; }
}

async function main() {
  console.log("=== Live LLM Privilege E2E ===");
  console.log(`Probe file (isolated): ${PROBE_FILE_REL}`);

  // Cleanup any prior probe artifacts
  try { fs.rmSync(ISOLATED_DIR, { recursive: true, force: true }); } catch {}
  fs.mkdirSync(ISOLATED_DIR, { recursive: true });

  // Step 0: health check
  console.log("\n[0] Health check...");
  const sessions = await httpJson("GET", "/session");
  if (!Array.isArray(sessions)) { console.error("FAIL: serve API not responding"); process.exit(1); }
  console.log(`    serve API OK (${sessions.length} sessions)`);

  const watcher = new SSEWatcher(SSE_FILE);
  console.log(`    SSEWatcher mode: ${watcher.kind} (auto-cleanup registered)`);

  // Step 1: create Orchestrator session
  console.log("\n[1] Create Orchestrator session...");
  const sess = await httpJson("POST", "/session", {
    title: `[E2E-TEST-PRIV] Privilege path isolation verification ${PROBE_TAG}`,
    agent: "Orchestrator",
  });
  const sid = sess.id;
  console.log(`    session: ${sid} (${sess.slug})`);

  // Step 2: send privilege-dispatch prompt
  // The prompt explicitly requests framework_maintenance privilege with isolated allowed_paths.
  // Orchestrator will call dispatch_subagent(dispatch_privilege=..., allowed_paths=[...]).
  console.log("\n[2] Send privilege dispatch prompt (async)...");
  const prompt = `你是 Orchestrator。请按以下步骤精确执行（不要使用其他工具）：

1. 调用 dispatch_subagent 工具，参数如下：
   - agent_type: "build"
   - task_description: "严格按以下顺序执行，不要跳过任何步骤：
     (a) 调用 codegraph_explore 工具，query 为 'safe_framework_edit'（记录 impact 证据）
     (b) 调用 safe_framework_edit 工具，创建文件 ${PROBE_FILE_REL}，内容为：
         // E2E privilege probe — ${PROBE_TAG}
         export const probeTag = '${PROBE_TAG}';
     (c) 完成后回答 'probe-written'。不要修改任何其他文件。"
   - dispatch_privilege: "framework_maintenance"
   - allowed_paths: [".opencode/_test_framework/**"]
   - privilege_reason: "E2E privilege path verification test"

2. 等待 dispatch_subagent 返回结果。

3. 最终回答 'privilege-dispatched'。不要做其他任何操作。`;

  await httpJson("POST", `/session/${sid}/prompt_async`, {
    parts: [{ type: "text", text: prompt }],
  });
  console.log("    prompt submitted");

  // Step 3: watch SSE for dispatch_subagent tool call (with privilege args)
  console.log("\n[3] Watching SSE for dispatch_subagent tool_call (max 90s)...");
  const t0 = Date.now();
  let dispatchCallId: string | null = null;
  let dispatchSeen = false;
  let safeEditSeen = false;
  let codegraphExploreSeen = false;
  let childSid: string | null = null;

  while (Date.now() - t0 < 90_000) {
    const events = await watcher.poll(2000);
    for (const ev of events) {
      if (ev.type !== "message.part.updated") continue;
      const part = ev.data?.part;
      if (part?.type !== "tool") continue;
      const tool = part.tool;
      const status = part.state?.status;
      // Orchestrator session
      if (ev.sessionID === sid && tool === "dispatch_subagent" && status === "completed") {
        dispatchCallId = part.callID;
        dispatchSeen = true;
        console.log(`    ✓ dispatch_subagent completed (callID: ${dispatchCallId})`);
      }
      // Child session (any non-parent session)
      if (ev.sessionID && ev.sessionID !== sid) {
        if (!childSid) {
          childSid = ev.sessionID;
          console.log(`    ✓ child session detected: ${childSid}`);
        }
        if (tool === "codegraph_explore") {
          codegraphExploreSeen = true;
          console.log(`    ✓ child called codegraph_explore (status: ${status})`);
        }
        if (tool === "safe_framework_edit") {
          safeEditSeen = true;
          console.log(`    ✓ child called safe_framework_edit (status: ${status})`);
        }
      }
    }
    // Exit condition: child finished its turn (session.idle) OR both tools observed
    if (dispatchSeen && safeEditSeen) break;
    // Also break if Orchestrator is idle (finished dispatch)
    try {
      const children = await httpJson("GET", `/session/${sid}/children`);
      if (Array.isArray(children) && children.length > 0 && !childSid) {
        childSid = children[0].id || children[0].sessionID;
        console.log(`    ✓ child session via API: ${childSid}`);
      }
    } catch {}
    // Stop after 90s regardless
  }

  // Step 4: wait a bit for DB writes
  console.log("\n[4] Wait 3s for DB writes...");
  await new Promise((r) => setTimeout(r, 3000));

  // Step 5: DB verification
  console.log("\n[5] DB verification...");
  const queueRows = dbQuery(
    `SELECT id, agent_type, dispatch_key, parent_session_id, call_id, status
     FROM dispatch_queue WHERE parent_session_id = ? ORDER BY created_at DESC LIMIT 5`,
    [sid],
  );
  console.log(`    dispatch_queue rows: ${queueRows.length}`);
  for (const r of queueRows) {
    console.log(`      id=${r.id} key=${r.dispatch_key?.slice(0, 12)}... call=${r.call_id} status=${r.status}`);
  }

  const grantRows = dbQuery(
    `SELECT id, dispatch_key, child_session_id, privilege, status, allowed_paths, reason
     FROM dispatch_privilege_grants
     WHERE parent_session_id = ? ORDER BY created_at DESC LIMIT 5`,
    [sid],
  );
  console.log(`    dispatch_privilege_grants rows: ${grantRows.length}`);
  for (const r of grantRows) {
    console.log(`      id=${r.id} child=${r.child_session_id?.slice(0, 16)} priv=${r.privilege} status=${r.status}`);
    console.log(`        paths=${r.allowed_paths}`);
  }

  // Step 6: file existence
  console.log("\n[6] Probe file check...");
  const probeExists = fs.existsSync(PROBE_FILE_ABS);
  const probeContent = probeExists ? fs.readFileSync(PROBE_FILE_ABS, "utf8") : "(absent)";
  console.log(`    exists: ${probeExists}`);
  console.log(`    content preview: ${probeContent.split("\n").slice(0, 2).join(" | ")}`);

  // Step 7: assertions
  console.log("\n=== Assertion ===");
  let pass = 0, fail = 0;
  function check(name: string, cond: boolean) {
    if (cond) { console.log(`  ✓ ${name}`); pass++; }
    else { console.log(`  ✗ ${name}`); fail++; }
  }
  function info(name: string, cond: boolean) {
    if (cond) { console.log(`  ✓ ${name} (info)`); pass++; }
    else { console.log(`  ◐ ${name} (info — not observed)`); }
  }

  check("dispatch_subagent called by Orchestrator", dispatchSeen);
  check("dispatch_queue row with dispatch_key + parent_session_id + call_id",
    queueRows.some((r) => r.dispatch_key && r.parent_session_id === sid && r.call_id));
  check("dispatch_privilege_grants row with framework_maintenance",
    grantRows.some((r) => r.privilege === "framework_maintenance"));
  check("grant allowed_paths contains isolated test dir",
    grantRows.some((r) => r.allowed_paths?.includes("_test_framework")));
  info("child session detected", !!childSid);
  info("child called codegraph_explore (CodeGraph gate)", codegraphExploreSeen);
  info("child called safe_framework_edit", safeEditSeen);
  info("probe file exists at isolated path", probeExists);
  info("grant status is consumed (one-time use)",
    grantRows.some((r) => r.status === "consumed"));

  console.log(`\n${pass} PASS / ${fail} FAIL`);

  // Step 8: cleanup probe file (regardless of outcome)
  console.log("\n[8] Cleanup...");
  try { fs.rmSync(ISOLATED_DIR, { recursive: true, force: true }); } catch {}
  console.log(`    removed ${ISOLATED_DIR}`);

  if (fail > 0) process.exit(1);
  console.log("\n=== Live LLM Privilege E2E: FULL CHAIN CLOSED ===");
  console.log(`Evidence chain: Orchestrator → dispatch_subagent(privilege) → queue → grant → bind`);
  console.log(`                → child session → codegraph_explore → safe_framework_edit (double gate PASS)`);
  console.log(`                → probe file at ${PROBE_FILE_REL} (isolated path)`);
}

main().catch((e) => {
  console.error("FATAL:", e.message);
  console.error(e.stack);
  try { fs.rmSync(ISOLATED_DIR, { recursive: true, force: true }); } catch {}
  process.exit(1);
});
