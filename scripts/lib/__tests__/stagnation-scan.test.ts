import { afterAll, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { scanStagnantBlueprints } from "../stagnation-scan.ts";

const WORKTREE_ROOT = resolve(import.meta.dir, "../../..");
const MS_PER_DAY = 86_400_000;
const V3_EXEMPT = "blueprint-audit-governance-evidence-and-status-closure-v3.md";

/** Isolate temp repos from the user's global git config (signing, hooks, identity). */
const GIT_ENV: Record<string, string> = {
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_SYSTEM: "/dev/null",
  GIT_AUTHOR_NAME: "Test",
  GIT_AUTHOR_EMAIL: "test@example.com",
  GIT_COMMITTER_NAME: "Test",
  GIT_COMMITTER_EMAIL: "test@example.com",
};

function git(cwd: string, args: string[], env: Record<string, string> = {}): void {
  execFileSync("git", args, { cwd, encoding: "utf8", env: { ...process.env, ...GIT_ENV, ...env } });
}

const tempRoots: string[] = [];

function makeRepo(): string {
  const root = mkdtempSync(join(tmpdir(), "stagnation-"));
  tempRoots.push(root);
  git(root, ["init", "-q"]);
  git(root, ["config", "user.name", "Test"]);
  git(root, ["config", "user.email", "test@example.com"]);
  return root;
}

/** ISO timestamp `days` whole days before `base`. */
function daysAgo(base: number, days: number): string {
  return new Date(base - days * MS_PER_DAY).toISOString();
}

/** Create `<root>/<relPath>` with `content` and commit it with the given author date. */
function commitFileAt(root: string, relPath: string, content: string, isoDate: string): void {
  const full = join(root, relPath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
  git(root, ["add", relPath]);
  git(root, ["-c", "commit.gpgsign=false", "commit", "-q", "-m", `commit ${relPath}`], {
    GIT_AUTHOR_DATE: isoDate,
    GIT_COMMITTER_DATE: isoDate,
  });
}

afterAll(() => {
  for (const root of tempRoots) rmSync(root, { recursive: true, force: true });
});

describe("stagnation-scan", () => {
  test("current repo state: all active blueprints fresh, none stagnant", () => {
    const result = scanStagnantBlueprints({ blueprintsDir: join(WORKTREE_ROOT, "blueprints") });
    expect(result.threshold_days).toBe(90);
    expect(result.total_active).toBe(19);
    expect(result.stagnant_count).toBe(0);
    expect(result.stagnant_files).toEqual([]);
    expect(result.scanned_at).toBeTruthy();
  });

  test("detects a stale, unreferenced blueprint as stagnant", () => {
    const now = Date.now();
    const root = makeRepo();
    commitFileAt(root, "blueprints/old.md", "# old\n", daysAgo(now, 200));
    commitFileAt(root, "blueprints/fresh.md", "# fresh\n", daysAgo(now, 5));

    const result = scanStagnantBlueprints({ blueprintsDir: join(root, "blueprints") });
    expect(result.total_active).toBe(2);
    expect(result.stagnant_count).toBe(1);
    expect(result.stagnant_files).toHaveLength(1);
    const stagnant = result.stagnant_files[0];
    expect(stagnant.path).toBe("blueprints/old.md");
    expect(stagnant.days_since).toBeGreaterThanOrEqual(200);
    expect(stagnant.last_update).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("exempt files (INDEX.md, frozen v3) are never flagged nor counted", () => {
    const now = Date.now();
    const root = makeRepo();
    commitFileAt(root, "blueprints/INDEX.md", "# index\n", daysAgo(now, 500));
    commitFileAt(root, `blueprints/${V3_EXEMPT}`, "# v3 frozen\n", daysAgo(now, 500));
    commitFileAt(root, "blueprints/old.md", "# old\n", daysAgo(now, 200));

    const result = scanStagnantBlueprints({ blueprintsDir: join(root, "blueprints") });
    // Only old.md is active; INDEX.md and the v3 blueprint are exempt.
    expect(result.total_active).toBe(1);
    expect(result.stagnant_count).toBe(1);
    expect(result.stagnant_files[0].path).toBe("blueprints/old.md");
    const flagged = result.stagnant_files.map((f) => f.path);
    expect(flagged).not.toContain("blueprints/INDEX.md");
    expect(flagged).not.toContain(`blueprints/${V3_EXEMPT}`);
  });

  test("a blueprint referenced by an active LATEST pointer is not flagged even when old", () => {
    const now = Date.now();
    const root = makeRepo();
    commitFileAt(root, "blueprints/foo.md", "# foo\n", daysAgo(now, 300));
    commitFileAt(root, "blueprints/bar.md", "# bar\n", daysAgo(now, 300));
    // LATEST pointer references foo.md but not bar.md.
    commitFileAt(root, "audits/some-audit/LATEST.md", "report_filename: foo.md\n", daysAgo(now, 1));

    const result = scanStagnantBlueprints({ blueprintsDir: join(root, "blueprints") });
    expect(result.total_active).toBe(2);
    expect(result.stagnant_count).toBe(1);
    expect(result.stagnant_files[0].path).toBe("blueprints/bar.md");
  });

  test("threshold boundary: exactly 90 days is not stagnant, 91 days is", () => {
    const now = Date.now();
    const root = makeRepo();
    commitFileAt(root, "blueprints/at90.md", "# at90\n", daysAgo(now, 90));
    commitFileAt(root, "blueprints/at91.md", "# at91\n", daysAgo(now, 91));

    const result = scanStagnantBlueprints({ blueprintsDir: join(root, "blueprints") });
    expect(result.total_active).toBe(2);
    expect(result.stagnant_count).toBe(1);
    expect(result.stagnant_files[0].path).toBe("blueprints/at91.md");

    const at90 = result.stagnant_files.find((f) => f.path === "blueprints/at90.md");
    expect(at90).toBeUndefined();
  });

  test("threshold is configurable via options", () => {
    const now = Date.now();
    const root = makeRepo();
    commitFileAt(root, "blueprints/ten.md", "# ten\n", daysAgo(now, 10));

    const defaultResult = scanStagnantBlueprints({ blueprintsDir: join(root, "blueprints") });
    expect(defaultResult.stagnant_count).toBe(0);

    const strictResult = scanStagnantBlueprints({ blueprintsDir: join(root, "blueprints"), thresholdDays: 5 });
    expect(strictResult.threshold_days).toBe(5);
    expect(strictResult.stagnant_count).toBe(1);
    expect(strictResult.stagnant_files[0].path).toBe("blueprints/ten.md");
  });
});
