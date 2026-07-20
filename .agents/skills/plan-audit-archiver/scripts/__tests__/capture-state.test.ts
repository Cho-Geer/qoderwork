import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { captureRepositoryState } from "../capture-state.ts";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function runGit(root: string, args: string[]) {
  const run = Bun.spawnSync({ cmd: ["git", "-C", root, ...args], stdout: "pipe", stderr: "pipe" });
  expect(run.exitCode).toBe(0);
}

describe("capture-state", () => {
  test("captures the exact clean and dirty repository states bound to a scope lock", () => {
    const workspace = mkdtempSync(join(tmpdir(), "audit-state-"));
    roots.push(workspace);
    const repository = join(workspace, "repository");
    mkdirSync(join(repository, "src"), { recursive: true });
    writeFileSync(join(repository, "src", "tracked.ts"), "export const value = 1;\n");
    runGit(repository, ["init", "-q"]);
    runGit(repository, ["add", "src/tracked.ts"]);
    runGit(repository, ["-c", "user.name=Audit Test", "-c", "user.email=audit@example.invalid", "commit", "-qm", "fixture"]);
    const scopeLock = join(workspace, "scope-lock.json");
    writeFileSync(scopeLock, "{\"lock_id\":\"LOCK-001\"}\n");

    const clean = captureRepositoryState({
      repositoryRoot: repository,
      scopeLockPath: scopeLock,
      phaseId: "LOCK-001",
      capturedAt: "2026-07-19T09:00:00+09:00",
    });
    expect(clean.status_entries).toEqual([]);
    expect(clean.scope_lock_sha256).toMatch(/^[a-f0-9]{64}$/);

    writeFileSync(join(repository, "src", "tracked.ts"), "export const value = 2;\n");
    writeFileSync(join(repository, "src", "untracked.ts"), "export const added = true;\n");
    const dirty = captureRepositoryState({
      repositoryRoot: repository,
      scopeLockPath: scopeLock,
      phaseId: "LOCK-001",
      capturedAt: "2026-07-19T11:00:00+09:00",
    });
    expect(dirty.status_entries.map((entry) => entry.path)).toEqual(["src/tracked.ts", "src/untracked.ts"]);
    expect(dirty.status_entries.every((entry) => /^[a-f0-9]{64}$/.test(entry.content_sha256))).toBeTrue();
  });
});
