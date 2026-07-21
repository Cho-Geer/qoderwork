import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

  test("--freeze sets scope.frozen_at and scope.status before computing scope_lock_sha256", () => {
    const workspace = mkdtempSync(join(tmpdir(), "audit-freeze-"));
    roots.push(workspace);
    const repository = join(workspace, "repository");
    mkdirSync(repository, { recursive: true });
    writeFileSync(join(repository, "init.ts"), "export const init = true;\n");
    runGit(repository, ["init", "-q"]);
    runGit(repository, ["add", "init.ts"]);
    runGit(repository, ["-c", "user.name=Audit Test", "-c", "user.email=audit@example.invalid", "commit", "-qm", "fixture"]);
    const scopeLock = join(workspace, "scope-lock.json");
    writeFileSync(scopeLock, JSON.stringify({ lock_id: "LOCK-FREEZE", scope: { status: "UNFROZEN", provenance_level: "v2.1-required" } }, null, 2) + "\n");

    const receipt = captureRepositoryState({
      repositoryRoot: repository,
      scopeLockPath: scopeLock,
      phaseId: "LOCK-FREEZE",
      capturedAt: "2026-07-21T12:00:01Z",
      freezeAt: "2026-07-21T12:00:00Z",
    });

    // scope-lock 文件已被更新
    const updatedLock = JSON.parse(readFileSync(scopeLock, "utf8"));
    expect(updatedLock.scope.frozen_at).toBe("2026-07-21T12:00:00Z");
    expect(updatedLock.scope.status).toBe("FROZEN");

    // receipt 绑定到更新后的 scope-lock sha256
    const { createHash } = require("node:crypto");
    const expectedSha = createHash("sha256").update(readFileSync(scopeLock)).digest("hex");
    expect(receipt.scope_lock_sha256).toBe(expectedSha);
    expect(receipt.captured_at).toBe("2026-07-21T12:00:01Z");
  });

  test("--freeze is idempotent: same timestamp produces same scope_lock_sha256", () => {
    const workspace = mkdtempSync(join(tmpdir(), "audit-freeze-idem-"));
    roots.push(workspace);
    const repository = join(workspace, "repository");
    mkdirSync(repository, { recursive: true });
    writeFileSync(join(repository, "init.ts"), "export const init = true;\n");
    runGit(repository, ["init", "-q"]);
    runGit(repository, ["add", "init.ts"]);
    runGit(repository, ["-c", "user.name=Audit Test", "-c", "user.email=audit@example.invalid", "commit", "-qm", "fixture"]);
    const scopeLock = join(workspace, "scope-lock.json");
    writeFileSync(scopeLock, JSON.stringify({ lock_id: "LOCK-IDEM", scope: { status: "UNFROZEN" } }, null, 2) + "\n");

    const receipt1 = captureRepositoryState({
      repositoryRoot: repository,
      scopeLockPath: scopeLock,
      phaseId: "LOCK-IDEM",
      capturedAt: "2026-07-21T12:00:01Z",
      freezeAt: "2026-07-21T12:00:00Z",
    });
    const receipt2 = captureRepositoryState({
      repositoryRoot: repository,
      scopeLockPath: scopeLock,
      phaseId: "LOCK-IDEM",
      capturedAt: "2026-07-21T12:00:02Z",
      freezeAt: "2026-07-21T12:00:00Z",
    });

    expect(receipt1.scope_lock_sha256).toBe(receipt2.scope_lock_sha256);
  });

  test("without --freeze, scope-lock file is not modified", () => {
    const workspace = mkdtempSync(join(tmpdir(), "audit-nofreeze-"));
    roots.push(workspace);
    const repository = join(workspace, "repository");
    mkdirSync(repository, { recursive: true });
    writeFileSync(join(repository, "init.ts"), "export const init = true;\n");
    runGit(repository, ["init", "-q"]);
    runGit(repository, ["add", "init.ts"]);
    runGit(repository, ["-c", "user.name=Audit Test", "-c", "user.email=audit@example.invalid", "commit", "-qm", "fixture"]);
    const scopeLock = join(workspace, "scope-lock.json");
    const originalContent = JSON.stringify({ lock_id: "LOCK-NOFREEZE", scope: { status: "FROZEN", frozen_at: "2026-07-21T11:00:00Z" } }, null, 2) + "\n";
    writeFileSync(scopeLock, originalContent);

    captureRepositoryState({
      repositoryRoot: repository,
      scopeLockPath: scopeLock,
      phaseId: "LOCK-NOFREEZE",
      capturedAt: "2026-07-21T12:00:01Z",
    });

    expect(readFileSync(scopeLock, "utf8")).toBe(originalContent);
  });
});
