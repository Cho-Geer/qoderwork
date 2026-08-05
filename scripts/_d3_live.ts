// _d3_live.ts — D3 deterministic live-integration test of the REAL
// tool-governance-handler production module (post D1/D2 contraction).
//
// Drives the actual handler code path:
//   handle() -> controller.evaluate() -> repo-policy -> presenter
//           -> writeLog("tool-governance","runtime") -> plugin-tool-governance-runtime.log
//           -> writeJsonl("audit")                  -> audit.jsonl
//
// Run with: OPENCODE_ROOT=${WORK_ONE_ROOT} \
//           ${HOME}/.bun/bin/bun run _d3_live.ts
//
// The handler module is imported from disk (NOT a mock), so this verifies the
// exact code the serve will load after restart.

import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import * as fs from "node:fs";
import * as path from "node:path";
import { resolveWorkspacePaths } from "./lib/workspace-paths";
const { workOneRoot } = resolveWorkspacePaths({ env: process.env });

const { handle } = await (async () => {
  const target = pathToFileURL(resolve(workOneRoot, ".opencode/plugin-handlers/before/tool-governance-handler.ts")).href;
  return await import(target);
})();
const { flushAll, getPluginLogPath } = await (async () => {
  const target = pathToFileURL(resolve(workOneRoot, ".opencode/lib/log-manager.ts")).href;
  return await import(target);
})();

const SID = "D3-live-" + Date.now();
const today = new Date().toISOString().slice(0, 10);
const WORK_ONE_ROOT =
  process.env.OPENCODE_ROOT || "${WORK_ONE_ROOT}";

interface Case {
  label: string;
  tool: string;
  args: Record<string, unknown>;
  expect: "allow" | "block";
}

const cases: Case[] = [
  { label: "github-read",  tool: "github_get_issue",   args: { owner: "o", repo: "r", issue_number: 1 }, expect: "allow" },
  { label: "github-write", tool: "github_create_issue", args: { owner: "o", repo: "r", title: "t" },       expect: "block" },
  { label: "safe-shell-git-status", tool: "safe_shell", args: { command: "git -C \"${WORK_ONE_ROOT}\" status --short" }, expect: "allow" },
  { label: "safe-shell-git-commit", tool: "safe_shell", args: { command: "git -C \"${WORK_ONE_ROOT}\" commit --allow-empty -m d3-live-test" }, expect: "block" },
];

async function runCase(c: Case): Promise<string> {
  try {
    await handle({ tool: c.tool, sessionID: SID, args: c.args, callID: c.label }, {});
    return "ALLOW(no-throw)";
  } catch (e: any) {
    const msg = String(e?.message ?? e).split("\n")[0];
    return "BLOCK(threw): " + msg;
  }
}

async function main() {
  console.log("SID=" + SID);
  for (const c of cases) {
    const r = await runCase(c);
    console.log(`[${c.label}] ${c.tool} => ${r}  (expected ${c.expect.toUpperCase()})`);
  }

  // Force synchronous flush of buffered logs to disk.
  flushAll();

  // Locate and inspect the produced governance log + audit jsonl.
  const govLog = getPluginLogPath("tool-governance", "runtime");
  const auditPath = path.join(
    WORK_ONE_ROOT,
    ".task_temp",
    "_logs",
    today,
    "audit.jsonl",
  );

  console.log("\n=== GOVERNANCE LOG: " + govLog + " ===");
  if (fs.existsSync(govLog)) {
    const lines = fs.readFileSync(govLog, "utf8").split("\n").filter((l) => l.includes(SID));
    const allow = lines.filter((l) => l.includes("GOVERNANCE-ALLOW"));
    const block = lines.filter((l) => l.includes("GOVERNANCE-BLOCK"));
    console.log(`ALLOW rows for SID: ${allow.length}`);
    allow.forEach((l) => console.log("  " + l.trim()));
    console.log(`BLOCK rows for SID: ${block.length}`);
    block.forEach((l) => console.log("  " + l.trim()));
  } else {
    console.log("  (governance log file NOT created)");
  }

  console.log("\n=== AUDIT JSONL: " + auditPath + " ===");
  if (fs.existsSync(auditPath)) {
    const rows = fs.readFileSync(auditPath, "utf8").split("\n").filter((l) => l.includes(SID) && /governance_(allow|block)/.test(l));
    console.log(`governance_allow/block rows for SID: ${rows.length}`);
    rows.forEach((l) => console.log("  " + l.trim()));
  } else {
    console.log("  (audit.jsonl NOT found)");
  }

  // Verdict
  const govText = fs.existsSync(govLog) ? fs.readFileSync(govLog, "utf8") : "";
  const hasAllowRepoOp = /GOVERNANCE-ALLOW.*REPO-OP/.test(govText) && govText.includes(SID);
  const hasBlockRepoOp = /GOVERNANCE-BLOCK.*REPO-OP/.test(govText) && govText.includes(SID);
  console.log("\n=== VERDICT ===");
  console.log("GOVERNANCE-ALLOW with REPO-OP present: " + hasAllowRepoOp);
  console.log("GOVERNANCE-BLOCK with REPO-OP present: " + hasBlockRepoOp);
  console.log(hasAllowRepoOp && hasBlockRepoOp ? "D3 PASS" : "D3 FAIL");
}

main();
