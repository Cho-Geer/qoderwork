#!/usr/bin/env bun
/**
 * QoderWork Watcher — R1–R7 over framework JSONL streams.
 *
 * Contract: documents/qoderwork-watcher-contract.md
 * Plan:     plans/02-phase1-skill-first.md Step 7
 *
 * Consumes up to four JSONL streams from work-one's `.task_temp/_logs/`:
 *   audit.jsonl, quality.jsonl, skill.jsonl, guidance.jsonl
 * Missing streams are skipped gracefully (quality/skill/guidance are Phase 4).
 *
 * Approximation note: R2/R3/R5 are proxied from whatever streams exist today.
 * Full semantic detection requires the three new streams (Phase 4 JSONL audit).
 */

import { readFileSync, existsSync } from "fs";

const DEFAULT_LOGS =
  "/home/zhaoge/workspace/opencode/work-one/.task_temp/_logs";

function parseArgs(argv: string[]) {
  let logs = DEFAULT_LOGS;
  let since: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--logs") logs = argv[++i];
    else if (argv[i] === "--since") since = argv[++i];
  }
  return { logs, since: since ? Date.parse(since) : 0 };
}

type Ev = Record<string, any>;
function loadJSONL(path: string): Ev[] {
  if (!existsSync(path)) return [];
  const out: Ev[] = [];
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const o = JSON.parse(line);
      if (o.timestamp) {
        const t = Date.parse(o.timestamp);
        if (!isNaN(t)) o._ts = t;
      }
      out.push(o);
    } catch {
      /* ignore malformed lines */
    }
  }
  return out;
}

const WINDOW = 30 * 60 * 1000; // 30 min

interface Trigger {
  rule: string;
  sessionID: string;
  detail: string;
  channel: "prompt_async" | "question_reply" | "abort";
}

function isFailure(e: Ev): boolean {
  return e.result === "error" || /error/i.test(String(e.event ?? ""));
}
function isWrite(e: Ev): boolean {
  return (
    /safe_edit|safe_delete|safe_shell|safe_restore|write|edit/i.test(
      String(e.tool ?? "")
    ) && e.result !== "blocked"
  );
}

function evaluate(audit: Ev[], quality: Ev[], skill: Ev[], guidance: Ev[]) {
  const triggers: Trigger[] = [];
  const bySession = (arr: Ev[]) => {
    const m = new Map<string, Ev[]>();
    for (const e of arr) {
      const s = e.sessionID ?? e.sessionId;
      if (!s) continue;
      if (!m.has(s)) m.set(s, []);
      m.get(s)!.push(e);
    }
    return m;
  };

  const aS = bySession(audit);
  const qS = bySession(quality);
  const sS = bySession(skill);
  const gS = bySession(guidance);

  // R1 repeated_failure: >=3 failures in 30min window per session
  for (const [sid, evs] of aS) {
    const fails = evs.filter(isFailure).sort((a, b) => a._ts - b._ts);
    for (let i = 0; i < fails.length; i++) {
      const inWindow = fails.filter(
        (f) => f._ts >= fails[i]._ts && f._ts <= fails[i]._ts + WINDOW
      );
      if (inWindow.length >= 3) {
        triggers.push({
          rule: "R1",
          sessionID: sid,
          detail: `${inWindow.length} tool errors within 30min`,
          channel: "prompt_async",
        });
        break;
      }
    }
  }

  // R2 skipped_brainstorming + R3 skipped_skill
  for (const [sid, evs] of aS) {
    const writes = evs.filter(isWrite);
    if (writes.length === 0) continue;
    const loaded = sS.get(sid) ?? [];
    const hasBrainstorming = loaded.some(
      (s) => /brainstorm/i.test(String(s.skill ?? ""))
    );
    const hasAnySkill = loaded.length > 0;
    const breakGlass = (gS.get(sid) ?? []).some(
      (g) => /break_glass/i.test(String(g.event ?? ""))
    );

    if (writes.length && !hasBrainstorming) {
      triggers.push({
        rule: "R2",
        sessionID: sid,
        detail: `writes without brainstorming skill loaded (proxy)`,
        channel: "prompt_async",
      });
    }
    if (writes.length && !hasAnySkill) {
      triggers.push({
        rule: "R3",
        sessionID: sid,
        detail: `writes without any task-matched skill loaded (proxy)`,
        channel: "prompt_async",
      });
    }

    // R4 todo_stall / R5 no_verification (need quality stream)
    const q = qS.get(sid) ?? [];
    if (q.some((e) => e.event === "todo_stale")) {
      triggers.push({
        rule: "R4",
        sessionID: sid,
        detail: `todo_stale event present`,
        channel: "prompt_async",
      });
    }
    if (q.some((e) => e.event === "verification_missing")) {
      triggers.push({
        rule: "R5",
        sessionID: sid,
        detail: `edit without verification event`,
        channel: "prompt_async",
      });
    }
    if (breakGlass) {
      triggers.push({
        rule: "R6",
        sessionID: sid,
        detail: `break-glass event detected`,
        channel: "abort",
      });
    }
  }

  // R7 quality_degradation: any two of R1/R2/R3 in same session
  const counts = new Map<string, Set<string>>();
  for (const t of triggers) {
    if (!["R1", "R2", "R3"].includes(t.rule)) continue;
    if (!counts.has(t.sessionID)) counts.set(t.sessionID, new Set());
    counts.get(t.sessionID)!.add(t.rule);
  }
  for (const [sid, set] of counts) {
    if (set.size >= 2) {
      triggers.push({
        rule: "R7",
        sessionID: sid,
        detail: `quality degradation: ${[...set].join("+")} co-occur`,
        channel: "prompt_async",
      });
    }
  }

  return triggers;
}

function main() {
  const { logs, since } = parseArgs(process.argv.slice(2));
  const audit = loadJSONL(`${logs}/audit.jsonl`).filter(
    (e) => e._ts >= since
  );
  const quality = loadJSONL(`${logs}/quality.jsonl`).filter(
    (e) => e._ts >= since
  );
  const skill = loadJSONL(`${logs}/skill.jsonl`).filter((e) => e._ts >= since);
  const guidance = loadJSONL(`${logs}/guidance.jsonl`).filter(
    (e) => e._ts >= since
  );

  const triggers = evaluate(audit, quality, skill, guidance);

  console.log("=== QoderWork Watcher Report ===");
  console.log(
    `streams: audit=${audit.length} quality=${quality.length} skill=${skill.length} guidance=${guidance.length}`
  );
  if (triggers.length === 0) {
    console.log("No R1-R7 triggers. (quality/skill/guidance may be empty — Phase 4.)");
    return;
  }
  console.log(`Triggers: ${triggers.length}`);
  for (const t of triggers) {
    console.log(
      `  [${t.rule}] ${t.sessionID} -> ${t.channel} :: ${t.detail}`
    );
  }
}

main();
