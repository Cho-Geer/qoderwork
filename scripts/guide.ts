#!/usr/bin/env bun
/**
 * guide.ts — Send guidance to a session with identity preservation.
 *
 * Usage:
 *   bun run guide.ts <SID> "<guidance text>" [--sync] [--timeout 60]
 *
 * What it does:
 *   1. GET /session/{SID} to read the REAL agent identity
 *   2. POST /session/{SID}/prompt_async with `{ parts, agent }` body
 *      (preserves the session's agent identity; omitting `agent` would
 *      let the serve API overwrite it with "Orchestrator" default)
 *   3. Print receipt (status, agent used, text head)
 *
 * With --sync: poll /session/{SID}/message until a new assistant message
 * appears after our send, then print it.
 *
 * Exit codes:
 *   0 = ok
 *   1 = bad args
 *   2 = network error / identity lookup failed
 */

const FETCH_TIMEOUT_MS = 10_000;

// ── argv helpers ──
// argvStr supports both `--key value` and `--key=value` forms.
// flag() only supports `--name` (no value).

function argvStr(key: string, dflt: string): string {
  const prefix = `--${key}=`;
  for (const a of process.argv) {
    if (a.startsWith(prefix)) return a.slice(prefix.length);
  }
  const i = process.argv.indexOf(`--${key}`);
  if (i < 0) return dflt;
  const v = process.argv[i + 1];
  return v && !v.startsWith("--") ? v : dflt;
}

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

const SERVE_URL = process.env.SERVE_URL || `http://localhost:${argvStr("port", "4096")}`;
const SYNC_TIMEOUT_MS = Number(argvStr("timeout", "60") + "000");

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

async function servePost(path: string, body: any): Promise<any> {
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

// ── Identity lookup ──

async function resolveAgent(sid: string): Promise<string> {
  const s = await serveGet(`/session/${sid}`);
  const agent = s?.agent;
  if (!agent || agent === "?") {
    throw new Error(`session ${sid} has no agent identity`);
  }
  return agent;
}

// ── Send + optional sync wait ──

async function sendGuidance(sid: string, text: string, agent: string): Promise<void> {
  const res = await servePost(`/session/${sid}/prompt_async`, {
    parts: [{ type: "text", text }],
    agent,
  });
  if (!res.ok) {
    throw new Error(`prompt_async failed: HTTP ${res.status} — ${JSON.stringify(res.body).slice(0, 200)}`);
  }
  console.log(`✓ sent to ${sid}`);
  console.log(`  agent: ${agent} (preserved)`);
  console.log(`  text:  ${text.slice(0, 120).replace(/\n/g, " ")}${text.length > 120 ? "..." : ""}`);
}

async function syncWait(sid: string, startedAt: number, timeoutMs: number): Promise<void> {
  // Poll /session/{sid}/message until we see a NEW assistant message (created > startedAt)
  const deadline = Date.now() + timeoutMs;
  let lastSeenIds = new Set<string>();
  // Seed with existing messages
  try {
    const seed = await serveGet(`/session/${sid}/message?limit=50`);
    if (Array.isArray(seed)) seed.forEach((m: any) => lastSeenIds.add(m.info?.id || m.id));
  } catch {}

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 2000));
    try {
      const msgs = await serveGet(`/session/${sid}/message?limit=50`);
      if (!Array.isArray(msgs)) continue;
      for (const m of msgs) {
        const id = m?.info?.id || m?.id;
        const role = m?.info?.role;
        const created = m?.info?.time?.created || 0;
        if (id && !lastSeenIds.has(id) && role === "assistant" && created > startedAt) {
          const textPart = (m.parts || []).find((p: any) => p.type === "text");
          const preview = (textPart?.text || "").slice(0, 300).replace(/\n/g, " ");
          console.log(`\n✓ assistant reply received:`);
          console.log(`  ${preview}${(textPart?.text?.length || 0) > 300 ? "..." : ""}`);
          return;
        }
      }
    } catch { /* ignore transient errors */ }
  }
  console.log(`\n⚠ sync timeout after ${timeoutMs / 1000}s (no new assistant message)`);
}

// ── main ──

async function main() {
  const sid = process.argv.find(a => a.startsWith("ses_"));
  // Text is the first non-ses_ arg that doesn't start with --
  const textIdx = process.argv.findIndex((a, i) => i > 1 && !a.startsWith("--") && !a.startsWith("ses_"));
  const text = textIdx > 0 ? process.argv[textIdx] : "";

  if (!sid || !text) {
    console.error(`Usage: bun run guide.ts <SID> "<guidance text>" [--sync] [--timeout 60] [--port 4096]`);
    process.exit(1);
  }

  const sync = flag("sync");
  const timeoutMs = parseInt(argvStr("timeout", "60"), 10) * 1000;
  const startedAt = Date.now();

  try {
    const agent = await resolveAgent(sid);
    await sendGuidance(sid, text, agent);
    if (sync) await syncWait(sid, startedAt, timeoutMs);
  } catch (e: any) {
    console.error(`ERROR: ${e.message}`);
    process.exit(2);
  }
}

main();
