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
  test("loadPrivilegeService imports from isolated worktree, not main work-one", async () => {
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
    
    const module = await import(`${manifest.paths.worktreeDir}/.opencode/service/dispatch/privilege.ts`);
    
    expect(module.SOURCE_MARKER).toBe(testMarker);
    expect(module.createGrant().id).toContain("isolated-grant-");
    expect(module.createGrant().id).toContain(testMarker);
  });
  
  test("import path uses manifest.paths.worktreeDir, not hardcoded main path", () => {
    const bootstrapSrc = readFileSync(
      join(dirname(__dirname), "bootstrap.ts"),
      "utf8"
    );
    
    expect(bootstrapSrc).toMatch(/import\(`\$\{manifest\.paths\.worktreeDir\}.*privilege\.ts`\)/);
    
    expect(bootstrapSrc).not.toContain("/home/zhaoge/workspace/opencode/work-one/.opencode");
  });
});