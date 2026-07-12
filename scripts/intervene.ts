#!/usr/bin/env bun
/**
 * intervene.ts — Unified intervention entry for OpenCode serve API.
 *
 * Four modes:
 *
 *   bun run intervene.ts <SID> --mode=guide --text="..."
 *       → Send guidance to SID with agent identity preserved.
 *
 *   bun run intervene.ts <SID> --mode=reply-qid <QID> --text="..."
 *       → Reply to a pending question; verifies QID belongs to SID.
 *
 *   bun run intervene.ts <SID> --mode=abort
 *       → Abort session; waits for session.error to confirm.
 *
 *   bun run intervene.ts <SID> --mode=status
 *       → Print turn status: idle | working | question-pending | error
 *
 * Exit codes:
 *   0 = ok
 *   1 = bad args
 *   2 = network / intervention error
 *   3 = QID does not belong to SID (reply-qid only)
 */

const FETCH_TIMEOUT_MS = 10_000;
const WORKING_WINDOW_MS = 15_000;

// ── argv helpers ──
// Support both `--key value` and `--key=value` forms.

function argvStr(key: string, dflt = ""): string {
  const prefix = `--${key}=`;
  for (const a of process.argv) {
    if (a.startsWith(prefix)) return a.slice(prefix.length);
  }
  const i = process.argv.indexOf(`--${key}`);
  if (i < 0) return dflt;
  const v = process.argv[i + 1];
  return v && !v.startsWith("--") ? v : dflt;
}

const SERVE_URL = process.env.SERVE_URL || `http://localhost:${argvStr("port", "4096")}`;

// ── HTTP ──

async function serveGet(path: string): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${SERVE_URL}${path}`, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return JSON.parse(await res.text());
  } catch (e: any) {
    clearTimeout(timer);
    throw e;
  }
}

async function servePost(path: string, body: any): Promise<{ status: number; ok: boolean; body: any }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${SERVE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    const text = await res.text();
    let parsed: any = null;
    try { parsed = JSON.parse(text); } catch { parsed = text; }
    return { status: res.status, ok: res.ok, body: parsed };
  } catch (e: any) {
    clearTimeout(timer);
    throw e;
  }
}

// ── Modes ──

async function modeGuide(sid: string, text: string): Promise<void> {
  if (!text) throw new Error("--text is required for --mode=guide");
  const s = await serveGet(`/session/${sid}`);
  const agent = s?.agent;
  if (!agent || agent === "?") throw new Error(`session ${sid} has no agent identity`);

  const res = await servePost(`/session/${sid}/prompt_async`, {
    parts: [{ type: "text", text }],
    agent,
  });
  if (!res.ok) {
    throw new Error(`prompt_async HTTP ${res.status}: ${JSON.stringify(res.body).slice(0, 200)}`);
  }
  console.log(`✓ guide sent`);
  console.log(`  sid:   ${sid}`);
  console.log(`  agent: ${agent} (preserved)`);
  console.log(`  text:  ${text.slice(0, 120).replace(/\n/g, " ")}${text.length > 120 ? "..." : ""}`);
}

async function modeReply(sid: string, qid: string, text: string): Promise<void> {
  if (!qid || !text) throw new Error("<QID> and --text are required for --mode=reply-qid");

  // Verify QID belongs to SID
  const qs = await serveGet("/question");
  if (!Array.isArray(qs)) throw new Error("GET /question did not return a list");
  const match = qs.find((q: any) => q?.id === qid);
  if (!match) throw new Error(`QID ${qid} not found in pending questions`);
  if (match.sessionID !== sid) {
    console.error(`✗ QID ${qid} belongs to ${match.sessionID}, not ${sid}`);
    process.exit(3);
  }

  // Reply format: answers is array-of-array, one inner array per question
  // For single-question prompts, [["<text>"]] is the standard shape.
  const res = await servePost(`/question/${qid}/reply`, {
    answers: [[text]],
  });
  if (!res.ok) {
    throw new Error(`reply HTTP ${res.status}: ${JSON.stringify(res.body).slice(0, 200)}`);
  }
  console.log(`✓ question replied`);
  console.log(`  sid:   ${sid}`);
  console.log(`  qid:   ${qid}`);
  console.log(`  text:  ${text.slice(0, 120).replace(/\n/g, " ")}`);
}

async function modeAbort(sid: string): Promise<void> {
  const res = await servePost(`/session/${sid}/abort`, {});
  if (!res.ok) {
    throw new Error(`abort HTTP ${res.status}: ${JSON.stringify(res.body).slice(0, 200)}`);
  }

  // Wait up to 10s for session.error confirmation
  const deadline = Date.now() + 10_000;
  let confirmed = false;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 1000));
    try {
      // A terminated session often still returns GET /session/{sid} but
      // has no ongoing message activity. Use time.updated staleness as a proxy.
      const s = await serveGet(`/session/${sid}`);
      const updated = s?.time?.updated || 0;
      if (Date.now() - updated > 3000) {
        confirmed = true;
        break;
      }
    } catch { /* treat GET failure as "session gone" → confirmed */
      confirmed = true;
      break;
    }
  }

  console.log(`✓ abort sent`);
  console.log(`  sid:       ${sid}`);
  console.log(`  confirmed: ${confirmed ? "yes" : "unconfirmed within 10s"}`);
}

async function modeStatus(sid: string): Promise<void> {
  let session: any;
  try {
    session = await serveGet(`/session/${sid}`);
  } catch (e: any) {
    console.log(`${sid} | error | ${e.message}`);
    return;
  }

  // question-pending?
  let pending = false;
  try {
    const qs = await serveGet("/question");
    if (Array.isArray(qs)) pending = qs.some((q: any) => q?.sessionID === sid);
  } catch {}

  const updated = session?.time?.updated || 0;
  const working = updated && Date.now() - updated < WORKING_WINDOW_MS;

  let status: "idle" | "working" | "question-pending" = "idle";
  if (pending) status = "question-pending";
  else if (working) status = "working";

  console.log(`${sid} | ${status} | agent=${session?.agent || "?"} | title=${(session?.title || "").slice(0, 60)}`);
}

// ── main ──

async function main() {
  const sid = process.argv.find(a => a.startsWith("ses_"));
  const qid = process.argv.find(a => a.startsWith("que_"));
  const mode = argvStr("mode", "");
  const text = argvStr("text", "");

  if (!sid || !mode) {
    console.error(`Usage:
  bun run intervene.ts <SID> --mode=guide --text="..."
  bun run intervene.ts <SID> --mode=reply-qid <QID> --text="..."
  bun run intervene.ts <SID> --mode=abort
  bun run intervene.ts <SID> --mode=status`);
    process.exit(1);
  }

  try {
    switch (mode) {
      case "guide":
        await modeGuide(sid, text);
        break;
      case "reply-qid":
        if (!qid) throw new Error("<QID> is required for --mode=reply-qid");
        await modeReply(sid, qid, text);
        break;
      case "abort":
        await modeAbort(sid);
        break;
      case "status":
        await modeStatus(sid);
        break;
      default:
        throw new Error(`unknown --mode=${mode}`);
    }
  } catch (e: any) {
    console.error(`ERROR: ${e.message}`);
    process.exit(2);
  }
}

main();
