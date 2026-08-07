// scripts/task-lens/__tests__/cli-integration.test.ts
// PHASE-05-v2: end-to-end CLI tests against real subprocesses.
// Uses a real temporary Git repo with a committed modification, a fake
// codegraph SQLite DB (provider boundary), and an external out root.
// Checks: TL-CLI-FLOW-v2 (generate → feedback → summarize with consistent
// exits/artifacts/metrics), TL-NEGATIVE-v2 singleton failure assertions.
// Single-mutations covered: TL-C-408 (remove generated before feedback).

import { test, expect, describe } from "bun:test";
import {
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  readFileSync,
  existsSync,
  rmSync,
  readdirSync,
} from "node:fs";
import { join } from "node:path";
import { Database } from "bun:sqlite";
import type { GeneratedEvent, FeedbackEvent } from "../metrics.ts";

// ---------------------------------------------------------------------------
// Platform helpers
// ---------------------------------------------------------------------------

/** Absolute repo root (worktree) — from import.meta.dir (repo/scripts/task-lens/__tests__). */
function repoRoot(): string {
  return join(import.meta.dir, "..", "..", "..");
}

function git(root: string, args: string[]): string {
  const r = Bun.spawnSync({
    cmd: ["git", ...args],
    cwd: root,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (r.exitCode !== 0) {
    throw new Error(`git ${args.join(" ")} -> ${r.exitCode}: ${r.stderr.toString()}`);
  }
  return r.stdout.toString();
}

/**
 * Build a temp fixture: git repo with an initial commit + staged modify, plus
 * a fake codegraph SQLite DB at <proj>/.codegraph/codegraph.db containing
 * `main` → `helper` calls. Returns cleanup.
 */
function buildFixture(): { proj: string; out: string; cleanup: () => void } {
  const proj = mkdtempSync("/tmp/tl-cli-proj-");
  const out = mkdtempSync("/tmp/tl-cli-out-");
  git(proj, ["init", "-q"]);
  git(proj, ["config", "user.email", "tl@test.t"]);
  git(proj, ["config", "user.name", "tl-test"]);
  writeFileSync(
    join(proj, "app.ts"),
    "export function main() {\n  return 1;\n}\nexport function helper() {\n  return 2;\n}\n",
  );
  git(proj, ["add", "-A"]);
  git(proj, ["commit", "-qm", "init"]);
  writeFileSync(
    join(proj, "app.ts"),
    "export function main() {\n  return 42;\n}\nexport function helper() {\n  return 2;\n}\n",
  );
  git(proj, ["add", "app.ts"]);

  const cgDir = join(proj, ".codegraph");
  mkdirSync(cgDir, { recursive: true });
  const db = new Database(join(cgDir, "codegraph.db"));
  db.run(
    `CREATE TABLE nodes (id TEXT PRIMARY KEY, kind TEXT NOT NULL, name TEXT NOT NULL, qualified_name TEXT, file_path TEXT NOT NULL, start_line INTEGER NOT NULL, end_line INTEGER NOT NULL, signature TEXT)`,
  );
  db.run(
    `CREATE TABLE edges (id INTEGER PRIMARY KEY, source TEXT NOT NULL, target TEXT NOT NULL, kind TEXT NOT NULL, metadata TEXT)`,
  );
  db.run(`CREATE TABLE schema_versions (version INTEGER NOT NULL)`);
  db.run(`INSERT INTO schema_versions VALUES (8)`);
  db.run(`CREATE TABLE project_metadata (key TEXT, value TEXT)`);
  db.run(`INSERT INTO project_metadata VALUES ('indexed_with_version','24.0.0')`);
  db.run(`INSERT INTO project_metadata VALUES ('extraction_version','24.0.0')`);
  db.run(
    `INSERT INTO nodes (id,kind,name,qualified_name,file_path,start_line,end_line,signature) VALUES ('main','function','main','main','app.ts',1,4,'main()')`,
  );
  db.run(
    `INSERT INTO nodes (id,kind,name,qualified_name,file_path,start_line,end_line,signature) VALUES ('helper','function','helper','helper','app.ts',6,8,'helper()')`,
  );
  db.run(
    `INSERT INTO edges (source,target,kind,metadata) VALUES ('main','helper','calls','{"confidence":0.9,"resolvedBy":"db"}')`,
  );
  db.close();

  return {
    proj,
    out,
    cleanup: () => {
      rmSync(proj, { recursive: true, force: true });
      rmSync(out, { recursive: true, force: true });
    },
  };
}

interface CliResult {
  exit: number;
  stdout: string;
  stderr: string;
}

/** Run `bun run task-lens ...` in a real subprocess (repo cwd). */
function runCli(args: string[], env: Record<string, string> = {}): CliResult {
  const r = Bun.spawnSync({
    cmd: ["bun", "run", "task-lens", ...args],
    cwd: repoRoot(),
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, ...env },
  });
  return { exit: r.exitCode, stdout: r.stdout.toString(), stderr: r.stderr.toString() };
}

function readMetricsLines(out: string): { generated: GeneratedEvent[]; feedback: FeedbackEvent[] } {
  const text = readFileSync(join(out, "metrics.jsonl"), "utf8");
  const generated: GeneratedEvent[] = [];
  const feedback: FeedbackEvent[] = [];
  for (const raw of text.split(/\r?\n/)) {
    if (raw.trim() === "") continue;
    const parsed = JSON.parse(raw) as { event: "generated" | "feedback" } & (
      | GeneratedEvent
      | FeedbackEvent
    );
    if (parsed.event === "generated") {
      generated.push(parsed as GeneratedEvent);
    } else {
      feedback.push(parsed as FeedbackEvent);
    }
  }
  return { generated, feedback };
}

// ---------------------------------------------------------------------------
// TL-CLI-FLOW-v2
// ---------------------------------------------------------------------------

describe("TL-CLI-FLOW-v2 generate → feedback → summarize", () => {
  test("all-pass: full CLI flow produces consistent artifacts + metrics + exits", async () => {
    const fx = buildFixture();
    try {
      // generate → exit 0 (complete task, no truncation).
      const gen = runCli([
        "generate",
        "--project", fx.proj,
        "--mode", "working-tree",
        "--out", fx.out,
      ]);
      expect(gen.exit).toBe(0);

      // Task dir committed with the three artifacts.
      const metrics = readMetricsLines(fx.out);
      expect(metrics.generated).toHaveLength(1);
      const taskId = metrics.generated[0]!.taskId;
      const taskDir = join(fx.out, taskId);
      expect(existsSync(join(taskDir, "card.md"))).toBe(true);
      expect(existsSync(join(taskDir, "graph.json"))).toBe(true);
      expect(existsSync(join(taskDir, "receipt.json"))).toBe(true);

      // Generated event fields.
      const ev = metrics.generated[0]!;
      expect(ev.event).toBe("generated");
      expect(ev.schemaVersion).toBe("task-lens.metrics/v1");
      expect(ev.artifactHashes.card).toMatch(/^[0-9a-f]{64}$/);
      expect(ev.artifactHashes.graph).toMatch(/^[0-9a-f]{64}$/);
      expect(ev.artifactHashes.receipt).toMatch(/^[0-9a-f]{64}$/);
      expect(ev.seedCount).toBeGreaterThanOrEqual(0);
      expect(ev.exitCode).toBe(0);

      // feedback → exit 0 (yes/no grammar).
      const fb = runCli([
        "feedback",
        "--out", fx.out,
        "--task-id", taskId,
        "--useful", "yes",
        "--load-reduced", "yes",
        "--issues-found", "2",
        "--issues-guided-by-card", "1",
        "--review-minutes", "10",
        "--notes", "review-ok",
      ]);
      expect(fb.exit).toBe(0);

      const after = readMetricsLines(fx.out);
      expect(after.feedback).toHaveLength(1);
      expect(after.feedback[0]!.taskId).toBe(taskId);
      expect(after.feedback[0]!.useful).toBe(true);
      expect(after.feedback[0]!.loadReduced).toBe(true);
      expect(after.feedback[0]!.reviewMinutes).toBe(10);
      expect(after.feedback[0]!.notes).toBe("review-ok");

      // summary → INCOMPLETE (1 task < 10), exit 2.
      const sum = runCli(["metrics", "summarize", "--out", fx.out]);
      expect(sum.exit).toBe(2);
      expect(sum.stdout).toContain("generated=1");
      expect(sum.stdout).toContain("feedback=1");
      expect(sum.stdout).toContain("gate=INCOMPLETE");

      // summary --json → machine-readable.
      const sumJson = runCli(["metrics", "summarize", "--out", fx.out, "--json"]);
      expect(sumJson.exit).toBe(2);
      const parsed = JSON.parse(sumJson.stdout);
      expect(parsed.schemaVersion).toBe("task-lens.summary/v1");
      expect(parsed.gate).toBe("INCOMPLETE");
      expect(parsed.missingFeedbackTaskIds).toEqual([]);

      // generate retry for the SAME task (same inputs) → exit 21 conflict.
      const genRetry = runCli([
        "generate",
        "--project", fx.proj,
        "--mode", "working-tree",
        "--out", fx.out,
      ]);
      expect(genRetry.exit).toBe(21);

      // Exactly one generated event and one feedback remain (no duplication).
      const final = readMetricsLines(fx.out);
      expect(final.generated).toHaveLength(1);
      expect(final.feedback).toHaveLength(1);
    } finally {
      fx.cleanup();
    }
  });

  test("TL-C-408 single-mutation: remove generated before feedback -> exit 10", async () => {
    const fx = buildFixture();
    try {
      const gen = runCli([
        "generate",
        "--project", fx.proj,
        "--mode", "working-tree",
        "--out", fx.out,
      ]);
      expect(gen.exit).toBe(0);
      const metrics = readMetricsLines(fx.out);
      const taskId = metrics.generated[0]!.taskId;

      // Only mutation: remove the generated event (keep task dir).
      const lines = readFileSync(join(fx.out, "metrics.jsonl"), "utf8")
        .split(/\r?\n/)
        .filter((l) => l.trim() !== "" && !l.includes('"event":"generated"'));
      writeFileSync(join(fx.out, "metrics.jsonl"), lines.join("\n") + "\n", "utf8");

      const fb = runCli([
        "feedback",
        "--out", fx.out,
        "--task-id", taskId,
        "--useful", "yes",
        "--load-reduced", "no",
        "--issues-found", "1",
        "--issues-guided-by-card", "0",
        "--review-minutes", "5",
      ]);
      expect(fb.exit).toBe(10);
      expect(fb.stderr).toContain("no generated event");
    } finally {
      fx.cleanup();
    }
  });

  test("TL-CLI negative: duplicate feedback -> exit 10", async () => {
    const fx = buildFixture();
    try {
      const gen = runCli([
        "generate",
        "--project", fx.proj,
        "--mode", "working-tree",
        "--out", fx.out,
      ]);
      expect(gen.exit).toBe(0);
      const taskId = readMetricsLines(fx.out).generated[0]!.taskId;

      const args = [
        "feedback",
        "--out", fx.out,
        "--task-id", taskId,
        "--useful", "yes",
        "--load-reduced", "yes",
        "--issues-found", "1",
        "--issues-guided-by-card", "0",
        "--review-minutes", "5",
      ];
      expect(runCli(args).exit).toBe(0);
      expect(runCli(args).exit).toBe(10); // duplicate
    } finally {
      fx.cleanup();
    }
  });

  test("feedback with unknown task -> exit 10", async () => {
    const fx = buildFixture();
    try {
      const fb = runCli([
        "feedback",
        "--out", fx.out,
        "--task-id", "does-not-exist",
        "--useful", "no",
        "--load-reduced", "no",
        "--issues-found", "0",
        "--issues-guided-by-card", "0",
        "--review-minutes", "1",
      ]);
      expect(fb.exit).toBe(10);
    } finally {
      fx.cleanup();
    }
  });

  test("metrics summarize on empty out -> INCOMPLETE exit 2 (no metrics.jsonl)", async () => {
    const fx = buildFixture();
    try {
      const sum = runCli(["metrics", "summarize", "--out", fx.out]);
      expect(sum.exit).toBe(2);
      expect(sum.stdout).toContain("generated=0");
      expect(sum.stdout).toContain("gate=INCOMPLETE");
    } finally {
      fx.cleanup();
    }
  });

  test("metrics summarize with corrupt metrics -> exit 21", async () => {
    const fx = buildFixture();
    try {
      writeFileSync(join(fx.out, "metrics.jsonl"), "not-valid-json\n", "utf8");
      const sum = runCli(["metrics", "summarize", "--out", fx.out]);
      expect(sum.exit).toBe(21);
      expect(sum.stderr).toContain("metrics unavailable");
    } finally {
      fx.cleanup();
    }
  });

  test("out dir artifact layout: task dir + metrics.jsonl co-exist", async () => {
    const fx = buildFixture();
    try {
      const gen = runCli([
        "generate",
        "--project", fx.proj,
        "--mode", "working-tree",
        "--out", fx.out,
      ]);
      expect(gen.exit).toBe(0);
      const taskId = readMetricsLines(fx.out).generated[0]!.taskId;
      const entries = readdirSync(fx.out);
      expect(entries).toContain(taskId);
      expect(entries).toContain("metrics.jsonl");
      // No stray lock dir left behind.
      expect(entries).not.toContain(".task-lens-metrics.lock");
    } finally {
      fx.cleanup();
    }
  });
});
