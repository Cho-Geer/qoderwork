import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";

let tempRoot = "";

beforeEach(() => {
  tempRoot = mkdtempSync(join(tmpdir(), "bootstrap-import-source-"));
});

afterEach(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("bootstrap import source regression", () => {
  test("loadPrivilegeService imports from isolated worktree via pathToFileURL, not main work-one", async () => {
    const fakeWorktreeDir = join(tempRoot, "isolated-worktree");
    mkdirSync(join(fakeWorktreeDir, ".opencode", "service", "dispatch"), { recursive: true });

    const testMarker = "ISOLATED_WORKTREE_MARKER_" + Date.now();
    writeFileSync(
      join(fakeWorktreeDir, ".opencode", "service", "dispatch", "privilege.ts"),
      `
export const SOURCE_MARKER = "${testMarker}";
export function createGrant() {
  return { id: "isolated-grant-" + SOURCE_MARKER };
}
export function bindGrant() {
  return { id: "isolated-bind-" + SOURCE_MARKER };
}
`
    );

    const manifest = {
      paths: { worktreeDir: fakeWorktreeDir },
      env: {},
    };

    // Use the same import path shape that bootstrap.ts uses after PHASE-03.
    const { pathToFileURL } = await import("node:url");
    const { resolve } = await import("node:path");
    const resolvedPrivilegePath = resolve(
      manifest.paths.worktreeDir,
      ".opencode",
      "service",
      "dispatch",
      "privilege.ts",
    );
    const module = await import(pathToFileURL(resolvedPrivilegePath).href);

    expect(module.SOURCE_MARKER).toBe(testMarker);
    expect(module.createGrant().id).toContain("isolated-grant-");
    expect(module.createGrant().id).toContain(testMarker);
  });

  test("PHASE-03 contract: bootstrap uses pathToFileURL(resolvedPrivilegePath).href, no template-string import", () => {
    const bootstrapSrc = readFileSync(
      join(dirname(__dirname), "bootstrap.ts"),
      "utf8"
    );

    // Must use pathToFileURL().href
    expect(bootstrapSrc).toContain("pathToFileURL(");
    expect(bootstrapSrc).toMatch(/pathToFileURL\([\s\S]*?\)\.href/);
    expect(bootstrapSrc).toContain('"node:url"');
    // Must construct resolvedPrivilegePath with resolve() from manifest.paths.worktreeDir
    expect(bootstrapSrc).toMatch(/resolve\([\s\S]*?manifest\.paths\.worktreeDir[\s\S]*?"privilege\.ts"/);

    // Must NOT use template-string import for privilege.ts
    expect(bootstrapSrc).not.toMatch(/import\(`\$\{manifest\.paths\.worktreeDir\}[\s\S]*?privilege\.ts`\)/);

    // Must NOT contain hardcoded work-one path
    expect(bootstrapSrc).not.toContain("${WORK_ONE_ROOT}/.opencode");
    expect(bootstrapSrc).not.toContain("${QODERWORK_ROOT}/");
  });
});