// scripts/task-lens/__tests__/input-diff.test.ts
// PHASE-02 — input/diff/receipt/CLI suites.
// Checks: TL-DIFF-WT, TL-DIFF-COMMIT, TL-DIFF-DELETE, TL-RECEIPT, TL-CLI.
// Single-mutations covered: TL-C-101, TL-C-105, TL-C-106, TL-C-108.
// At least one test exercises the real runCommand (TL-DIFF-WT all-pass).

import { test, describe, expect, beforeEach, afterEach } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  extractDiff,
  createInputReceipt,
  EmptyDiffError,
  DiffInputError,
} from "../diff-extractor.ts";
import { runCommand } from "../command-runner.ts";
import { parseCli } from "../cli.ts";
import { CliError } from "../types.ts";
import {
  type CommandRequest,
  type CommandResult,
  type CommandRunner,
  type DiffModel,
  type ProviderMetadata,
  ProcessFailure,
  PROVIDER_PLACEHOLDER,
} from "../types.ts";

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

interface Fixture {
  root: string;
  headSha: string;
  outParent: string;
  cleanup: () => void;
}

function git(root: string, args: string[]): string {
  const r = Bun.spawnSync({ cmd: ["git", ...args], cwd: root, stdout: "pipe", stderr: "pipe" });
  if (r.exitCode !== 0) {
    throw new Error(`git ${args.join(" ")} -> ${r.exitCode}: ${r.stderr.toString()}`);
  }
  return r.stdout.toString();
}

/**
 * All-pass fixture: initial commit + staged modify + unstaged modify + untracked
 * + rename + delete. This is the diff truth oracle (ORACLE-001).
 */
function buildMixedFixture(): Fixture {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tl-wt-"));
  const outParent = fs.mkdtempSync(path.join(os.tmpdir(), "tl-out-"));
  git(root, ["init", "-q"]);
  git(root, ["config", "user.email", "tl@test.t"]);
  git(root, ["config", "user.name", "tl-test"]);
  // initial content
  fs.writeFileSync(path.join(root, "keep.txt"), "a\nb\nc\nd\n");
  fs.writeFileSync(path.join(root, "del.txt"), "old1\nold2\nold3\n");
  fs.writeFileSync(path.join(root, "ren.txt"), "orig-line\n");
  fs.writeFileSync(path.join(root, "stable.txt"), "z\n");
  git(root, ["add", "-A"]);
  git(root, ["commit", "-qm", "init"]);
  // staged modify (keep.txt: change b->B, staged)
  fs.writeFileSync(path.join(root, "keep.txt"), "a\nB\nc\nd\n");
  git(root, ["add", "keep.txt"]);
  // staged delete (del.txt)
  git(root, ["rm", "-q", "del.txt"]);
  // staged rename (ren.txt -> renamed.txt)
  git(root, ["mv", "ren.txt", "renamed.txt"]);
  // unstaged modify (stable.txt: z->Z, NOT staged)
  fs.writeFileSync(path.join(root, "stable.txt"), "z\nZ\n");
  // untracked
  fs.writeFileSync(path.join(root, "new.txt"), "untracked\n");
  const headSha = git(root, ["rev-parse", "HEAD"]).trim();
  return {
    root,
    headSha,
    outParent,
    cleanup: () => {
      fs.rmSync(root, { recursive: true, force: true });
      fs.rmSync(outParent, { recursive: true, force: true });
    },
  };
}

/** Clean fixture with two commits for commit-mode tests. */
function buildCleanCommitFixture(): { root: string; baseSha: string; headSha: string; cleanup: () => void } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tl-commit-"));
  git(root, ["init", "-q"]);
  git(root, ["config", "user.email", "tl@test.t"]);
  git(root, ["config", "user.name", "tl-test"]);
  fs.writeFileSync(path.join(root, "a.txt"), "1\n2\n3\n");
  git(root, ["add", "-A"]);
  git(root, ["commit", "-qm", "base"]);
  const baseSha = git(root, ["rev-parse", "HEAD"]).trim();
  fs.writeFileSync(path.join(root, "a.txt"), "1\n2\n3\n4\n");
  fs.writeFileSync(path.join(root, "b.txt"), "new\n");
  git(root, ["add", "-A"]);
  git(root, ["commit", "-qm", "head"]);
  const headSha = git(root, ["rev-parse", "HEAD"]).trim();
  return { root, baseSha, headSha, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
}

const PROVIDER: ProviderMetadata = {
  name: "unresolved",
  schemaVersion: null,
  available: false,
  resolvedBy: null,
};

// ---------------------------------------------------------------------------
// TL-DIFF-WT
// ---------------------------------------------------------------------------

describe("TL-DIFF-WT working-tree extraction", () => {
  let fx: Fixture;
  beforeEach(() => {
    fx = buildMixedFixture();
  });
  afterEach(() => fx.cleanup());

  test("all-pass: real runCommand, three change kinds present", async () => {
    // This test exercises the REAL runCommand (no fake injection).
    const model = await extractDiff(
      { projectRealpath: fx.root, mode: "working-tree" },
      runCommand,
    );
    expect(model.mode).toBe("working-tree");
    expect(model.baseSha).toBe(model.headSha);
    expect(model.baseSha).toBe(fx.headSha);
    // staged modify + staged delete + rename + unstaged modify => hunks present
    expect(model.hunks.length).toBeGreaterThan(0);
    // untracked
    expect(model.untrackedFiles).toContain("new.txt");
    // rename preserved
    expect(model.renames.some((r) => r.oldPath === "ren.txt" && r.newPath === "renamed.txt")).toBe(true);
    // delete preserved as DeletedRegion
    expect(model.deletedRegions.some((d) => d.oldPath === "del.txt")).toBe(true);
    // diffHash is a 64-hex sha256
    expect(model.diffHash).toMatch(/^[0-9a-f]{64}$/);
    // hunks stable-sorted by (oldPath,newPath,oldStart,newStart)
    for (let i = 1; i < model.hunks.length; i++) {
      const a = model.hunks[i - 1]!;
      const b = model.hunks[i]!;
      const ka = [a.oldPath, a.newPath, a.oldStart, a.newStart];
      const kb = [b.oldPath, b.newPath, b.oldStart, b.newStart];
      expect(ka <= kb).toBe(true);
    }
  });

  test("TL-C-101 single-mutation: remove live file, keep deletion -> TL-DIFF-DELETE still singleton", async () => {
    // FAKE-INJECTION: runCommand replaced, real runCommand not exercised here.
    // FAKE-INJECTION: runCommand replaced, real runCommand not exercised here.
    const fx2 = buildMixedFixture();
    try {
      // Remove the live (keep.txt) modification so only the deletion remains.
      fs.writeFileSync(path.join(fx2.root, "keep.txt"), "a\nb\nc\nd\n");
      git(fx2.root, ["add", "keep.txt"]);
      // unstage rename? keep rename + delete + untracked; ensure no live modify hunk.
      const model = await extractDiff(
        { projectRealpath: fx2.root, mode: "working-tree" },
        runCommand,
      );
      // DeletedRegion for del.txt must still be present with preimage-only provenance.
      const dels = model.deletedRegions.filter((d) => d.oldPath === "del.txt");
      expect(dels.length).toBe(1);
      expect(dels[0]!.provenance).toBe("preimage-only");
      expect(dels[0]!.excerptHash).toMatch(/^[0-9a-f]{64}$/);
      expect(dels[0]!.startLine).toBe(1);
      expect(dels[0]!.endLine).toBe(3);
    } finally {
      fx2.cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// TL-DIFF-COMMIT
// ---------------------------------------------------------------------------

describe("TL-DIFF-COMMIT commit extraction", () => {
  test("all-pass: full SHA + current HEAD + clean worktree", async () => {
    const fx = buildCleanCommitFixture();
    try {
      const model = await extractDiff(
        { projectRealpath: fx.root, mode: "commit", baseSha: fx.baseSha },
        runCommand,
      );
      expect(model.mode).toBe("commit");
      expect(model.baseSha).toBe(fx.baseSha);
      expect(model.headSha).toBe(fx.headSha);
      expect(model.hunks.length).toBeGreaterThan(0);
    } finally {
      fx.cleanup();
    }
  });

  test("TL-C-105 single-mutation: dirty worktree -> exit 10", async () => {
    const fx = buildCleanCommitFixture();
    try {
      fs.writeFileSync(path.join(fx.root, "dirty.txt"), "dirty\n");
      await expect(
        extractDiff(
          { projectRealpath: fx.root, mode: "commit", baseSha: fx.baseSha },
          runCommand,
        ),
      ).rejects.toThrow();
      try {
        await extractDiff(
          { projectRealpath: fx.root, mode: "commit", baseSha: fx.baseSha },
          runCommand,
        );
      } catch (e) {
        expect(e).toBeInstanceOf(DiffInputError);
        expect((e as DiffInputError).exitCode).toBe(10);
      }
    } finally {
      fx.cleanup();
    }
  });

  test("commit mode with non-existent base ref -> ProcessFailure (exit 20), not NOT_FOUND", async () => {
    const fx = buildCleanCommitFixture();
    try {
      // Full 40-hex SHA that does not exist in the repo.
      const fake = "0".repeat(40);
      await expect(
        extractDiff(
          { projectRealpath: fx.root, mode: "commit", baseSha: fake },
          runCommand,
        ),
      ).rejects.toBeInstanceOf(ProcessFailure);
    } finally {
      fx.cleanup();
    }
  });

  test("commit mode with `-`-prefixed base -> exit 10 (not passed to git)", async () => {
    const fx = buildCleanCommitFixture();
    try {
      try {
        await extractDiff(
          { projectRealpath: fx.root, mode: "commit", baseSha: "-x" },
          runCommand,
        );
        throw new Error("should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(DiffInputError);
        expect((e as DiffInputError).exitCode).toBe(10);
      }
    } finally {
      fx.cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// TL-DIFF-DELETE
// ---------------------------------------------------------------------------

describe("TL-DIFF-DELETE DeletedRegion parsing", () => {
  test("all-pass: hash + range + provenance=preimage-only", async () => {
    const fx = buildMixedFixture();
    try {
      const model = await extractDiff(
        { projectRealpath: fx.root, mode: "working-tree" },
        runCommand,
      );
      const del = model.deletedRegions.find((d) => d.oldPath === "del.txt");
      expect(del).toBeDefined();
      expect(del!.startLine).toBe(1);
      expect(del!.endLine).toBe(3);
      expect(del!.excerptHash).toMatch(/^[0-9a-f]{64}$/);
      expect(del!.provenance).toBe("preimage-only");
      // excerptHash is sha256 of joined removed lines
      const { createHash } = await import("node:crypto");
      const expected = createHash("sha256").update("old1\nold2\nold3").digest("hex");
      expect(del!.excerptHash).toBe(expected);
    } finally {
      fx.cleanup();
    }
  });

  test("pure-deletion-only repo still extracts DeletedRegion (no live seed synthesized)", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "tl-delonly-"));
    try {
      git(root, ["init", "-q"]);
      git(root, ["config", "user.email", "tl@test.t"]);
      git(root, ["config", "user.name", "tl-test"]);
      fs.writeFileSync(path.join(root, "gone.txt"), "l1\nl2\n");
      git(root, ["add", "-A"]);
      git(root, ["commit", "-qm", "init"]);
      git(root, ["rm", "-q", "gone.txt"]);
      const model = await extractDiff(
        { projectRealpath: root, mode: "working-tree" },
        runCommand,
      );
      expect(model.deletedRegions.length).toBe(1);
      expect(model.deletedRegions[0]!.oldPath).toBe("gone.txt");
      expect(model.hunks.length).toBe(1);
      expect(model.hunks[0]!.kind).toBe("delete");
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test("empty diff -> EmptyDiffError exit 13", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "tl-empty-"));
    try {
      git(root, ["init", "-q"]);
      git(root, ["config", "user.email", "tl@test.t"]);
      git(root, ["config", "user.name", "tl-test"]);
      fs.writeFileSync(path.join(root, "a.txt"), "x\n");
      git(root, ["add", "-A"]);
      git(root, ["commit", "-qm", "init"]);
      await expect(
        extractDiff({ projectRealpath: root, mode: "working-tree" }, runCommand),
      ).rejects.toBeInstanceOf(EmptyDiffError);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// TL-RECEIPT
// ---------------------------------------------------------------------------

describe("TL-RECEIPT canonical taskId determinism", () => {
  test("TL-C-106 single-mutation: change generatedAt only -> taskId unchanged", () => {
    const baseInput = {
      projectRealpath: "/tmp/proj",
      mode: "working-tree" as const,
      baseSha: "0".repeat(40),
      headSha: "1".repeat(40),
      diffHash: "d".repeat(64),
      configHash: "c".repeat(64),
      coverageHash: null,
      provider: PROVIDER_PLACEHOLDER,
    };
    const r1 = createInputReceipt(baseInput, () => "2026-07-23T00:00:00.000Z");
    const r2 = createInputReceipt(baseInput, () => "2026-07-23T23:59:59.999Z");
    expect(r1.taskId).toBe(r2.taskId);
    expect(r1.generatedAt).not.toBe(r2.generatedAt);
    expect(r1.taskId).toMatch(/^[0-9a-f]{64}$/);
    expect(r1.schemaVersion).toBe("task-lens.input/v1");
    expect(r1.coverage).toBe(null);
    expect(r1.configSchemaVersion).toBe("task-lens.config/v1");
  });

  test("any input field change -> taskId changes", () => {
    const base = {
      projectRealpath: "/tmp/proj",
      mode: "working-tree" as const,
      baseSha: "0".repeat(40),
      headSha: "1".repeat(40),
      diffHash: "d".repeat(64),
      configHash: "c".repeat(64),
      coverageHash: null,
      provider: PROVIDER_PLACEHOLDER,
    };
    const r1 = createInputReceipt(base, () => "t1");
    const r2 = createInputReceipt({ ...base, diffHash: "e".repeat(64) }, () => "t1");
    expect(r1.taskId).not.toBe(r2.taskId);
  });

  test("taskId independently recomputed from canonical JSON matches", async () => {
    const { createHash } = await import("node:crypto");
    const input = {
      projectRealpath: "/tmp/proj",
      mode: "working-tree" as const,
      baseSha: "a".repeat(40),
      headSha: "b".repeat(40),
      diffHash: "d".repeat(64),
      configHash: "c".repeat(64),
      coverageHash: null,
      provider: PROVIDER_PLACEHOLDER,
    };
    const receipt = createInputReceipt(input, () => "t");
    const canonical = JSON.stringify({
      schemaVersion: "task-lens.input/v1",
      projectRealpath: input.projectRealpath,
      mode: input.mode,
      baseSha: input.baseSha,
      headSha: input.headSha,
      diffHash: input.diffHash,
      configHash: input.configHash,
      coverageHash: input.coverageHash,
      provider: {
        name: PROVIDER_PLACEHOLDER.name,
        schemaVersion: PROVIDER_PLACEHOLDER.schemaVersion,
        available: PROVIDER_PLACEHOLDER.available,
        resolvedBy: PROVIDER_PLACEHOLDER.resolvedBy,
      },
    });
    const expected = createHash("sha256").update(canonical, "utf8").digest("hex");
    expect(receipt.taskId).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// TL-CLI
// ---------------------------------------------------------------------------

describe("TL-CLI parseCli grammar", () => {
  test("all-pass: generate parses all flags", () => {
    const req = parseCli([
      "generate",
      "--project", "/tmp/p",
      "--mode", "working-tree",
      "--out", "/tmp/out",
    ]);
    expect(req.subcommand).toBe("generate");
    if (req.subcommand === "generate") {
      expect(req.project).toBe("/tmp/p");
      expect(req.mode).toBe("working-tree");
      expect(req.out).toBe("/tmp/out");
    }
  });

  test("generate --mode commit requires full-SHA --base", () => {
    const sha = "0".repeat(40);
    const req = parseCli([
      "generate",
      "--project", "/tmp/p",
      "--mode", "commit",
      "--out", "/tmp/out",
      "--base", sha,
    ]);
    expect(req.subcommand).toBe("generate");
    if (req.subcommand === "generate") {
      expect(req.base).toBe(sha);
    }
  });

  test("feedback parses all flags", () => {
    const req = parseCli([
      "feedback",
      "--out", "/tmp/out",
      "--task-id", "abc",
      "--useful", "true",
      "--load-reduced", "false",
      "--issues-found", "3",
      "--issues-guided-by-card", "2",
      "--review-minutes", "15",
    ]);
    expect(req.subcommand).toBe("feedback");
    if (req.subcommand === "feedback") {
      expect(req.useful).toBe(true);
      expect(req.issuesFound).toBe(3);
      expect(req.issuesGuidedByCard).toBe(2);
    }
  });

  test("metrics summarize parses", () => {
    const req = parseCli(["metrics", "summarize", "--out", "/tmp/out"]);
    expect(req.subcommand).toBe("metrics");
    if (req.subcommand === "metrics") {
      expect(req.action).toBe("summarize");
    }
  });

  test("TL-C-108 single-mutation: --base=-x -> exit 10", () => {
    try {
      parseCli([
        "generate",
        "--project", "/tmp/p",
        "--mode", "commit",
        "--out", "/tmp/out",
        "--base", "-x",
      ]);
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(CliError);
      expect((e as CliError).exitCode).toBe(10);
    }
  });

  test("unknown subcommand -> exit 10", () => {
    try {
      parseCli(["bogus"]);
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(CliError);
      expect((e as CliError).exitCode).toBe(10);
    }
  });

  test("missing required flag -> exit 10", () => {
    try {
      parseCli(["generate", "--project", "/tmp/p", "--mode", "working-tree"]);
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(CliError);
      expect((e as CliError).exitCode).toBe(10);
    }
  });

  test("non-absolute project -> exit 10", () => {
    try {
      parseCli(["generate", "--project", "rel", "--mode", "working-tree", "--out", "/tmp/o"]);
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(CliError);
      expect((e as CliError).exitCode).toBe(10);
    }
  });

  test("generate with --base on working-tree mode -> exit 10", () => {
    try {
      parseCli([
        "generate",
        "--project", "/tmp/p",
        "--mode", "working-tree",
        "--out", "/tmp/o",
        "--base", "0".repeat(40),
      ]);
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(CliError);
      expect((e as CliError).exitCode).toBe(10);
    }
  });

  test("issues_guided_by_card > issues_found -> exit 10", () => {
    try {
      parseCli([
        "feedback",
        "--out", "/tmp/out",
        "--task-id", "abc",
        "--useful", "true",
        "--load-reduced", "false",
        "--issues-found", "1",
        "--issues-guided-by-card", "2",
        "--review-minutes", "1",
      ]);
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(CliError);
      expect((e as CliError).exitCode).toBe(10);
    }
  });

  test("metrics non-summarize action -> exit 10", () => {
    try {
      parseCli(["metrics", "delete", "--out", "/tmp/o"]);
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(CliError);
      expect((e as CliError).exitCode).toBe(10);
    }
  });
});
