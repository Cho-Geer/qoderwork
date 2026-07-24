import { afterEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
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

  test("--freeze auto-fills created_at and approval.approved_at when they are placeholders", () => {
    const workspace = mkdtempSync(join(tmpdir(), "audit-freeze-ts-"));
    roots.push(workspace);
    const repository = join(workspace, "repository");
    mkdirSync(repository, { recursive: true });
    writeFileSync(join(repository, "init.ts"), "export const init = true;\n");
    runGit(repository, ["init", "-q"]);
    runGit(repository, ["add", "init.ts"]);
    runGit(repository, ["-c", "user.name=Audit Test", "-c", "user.email=audit@example.invalid", "commit", "-qm", "fixture"]);
    const scopeLock = join(workspace, "scope-lock.json");
    writeFileSync(scopeLock, JSON.stringify({
      lock_id: "LOCK-TS",
      created_at: "REPLACE_UTC_TIMESTAMP_USE_capture_state_--freeze",
      scope: { status: "UNFROZEN", provenance_level: "v2.1-required", frozen_at: "REPLACE_UTC_TIMESTAMP_USE_capture_state_--freeze" },
      approval: { status: "APPROVED", actor_type: "HUMAN", approved_by: "tester", approved_at: "REPLACE_UTC_TIMESTAMP_USE_capture_state_--freeze", evidence: "test" },
    }, null, 2) + "\n");

    captureRepositoryState({
      repositoryRoot: repository,
      scopeLockPath: scopeLock,
      phaseId: "LOCK-TS",
      capturedAt: "2026-07-21T12:00:01Z",
      freezeAt: "2026-07-21T12:00:00Z",
    });

    const updatedLock = JSON.parse(readFileSync(scopeLock, "utf8"));
    expect(updatedLock.created_at).toBe("2026-07-21T12:00:00Z");
    expect(updatedLock.scope.frozen_at).toBe("2026-07-21T12:00:00Z");
    expect(updatedLock.approval.approved_at).toBe("2026-07-21T12:00:00Z");
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

  test("canonical hash is stable across different captured_at with same repository state", () => {
    const workspace = mkdtempSync(join(tmpdir(), "audit-canonical-"));
    roots.push(workspace);
    const repository = join(workspace, "repository");
    mkdirSync(repository, { recursive: true });
    writeFileSync(join(repository, "init.ts"), "export const init = true;\n");
    runGit(repository, ["init", "-q"]);
    runGit(repository, ["add", "init.ts"]);
    runGit(repository, ["-c", "user.name=Audit Test", "-c", "user.email=audit@example.invalid", "commit", "-qm", "fixture"]);
    const scopeLock = join(workspace, "scope-lock.json");
    writeFileSync(scopeLock, JSON.stringify({ lock_id: "LOCK-CANON" }, null, 2) + "\n");

    const receipt1 = captureRepositoryState({
      repositoryRoot: repository,
      scopeLockPath: scopeLock,
      phaseId: "LOCK-CANON",
      capturedAt: "2026-07-21T12:00:01Z",
    });
    const receipt2 = captureRepositoryState({
      repositoryRoot: repository,
      scopeLockPath: scopeLock,
      phaseId: "LOCK-CANON",
      capturedAt: "2026-07-21T12:30:00Z",
    });

    // captured_at differs by construction, but the canonical hash (which
    // excludes captured_at) must be identical for the same repository state.
    expect(receipt1.captured_at).not.toBe(receipt2.captured_at);
    const { captured_at: _ignored1, ...rest1 } = receipt1;
    const { captured_at: _ignored2, ...rest2 } = receipt2;
    const canonical1 = createHash("sha256").update(JSON.stringify(rest1)).digest("hex");
    const canonical2 = createHash("sha256").update(JSON.stringify(rest2)).digest("hex");
    expect(canonical1).toBe(canonical2);
    expect(canonical1).toMatch(/^[a-f0-9]{64}$/);
  });

  test("CLI output includes canonical_sha256 excluding captured_at", () => {
    const workspace = mkdtempSync(join(tmpdir(), "audit-canonical-cli-"));
    roots.push(workspace);
    const repository = join(workspace, "repository");
    mkdirSync(repository, { recursive: true });
    writeFileSync(join(repository, "init.ts"), "export const init = true;\n");
    runGit(repository, ["init", "-q"]);
    runGit(repository, ["add", "init.ts"]);
    runGit(repository, ["-c", "user.name=Audit Test", "-c", "user.email=audit@example.invalid", "commit", "-qm", "fixture"]);
    const scopeLock = join(workspace, "scope-lock.json");
    writeFileSync(scopeLock, JSON.stringify({ lock_id: "LOCK-CLI" }, null, 2) + "\n");
    const captureScript = join(import.meta.dir, "..", "capture-state.ts");
    const outputPath = join(workspace, "state.json");
    const run = Bun.spawnSync({ cmd: [process.execPath, "run", captureScript, "--output", outputPath, "--scope-lock", scopeLock, "--repository-root", repository, "--phase-id", "LOCK-CLI"], stdout: "pipe", stderr: "pipe" });
    expect(run.exitCode).toBe(0);
    const out = JSON.parse(run.stdout.toString());
    expect(out.canonical_sha256).toMatch(/^[a-f0-9]{64}$/);
    const receipt = JSON.parse(readFileSync(outputPath, "utf8"));
    const { captured_at, ...rest } = receipt;
    const expected = createHash("sha256").update(JSON.stringify(rest)).digest("hex");
    expect(out.canonical_sha256).toBe(expected);
  });
});
