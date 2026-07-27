import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { resolveSkillSummaryModulePath } from "../_b1_live.ts";

describe("B1 explicit handler module path", () => {
  test("explicit_work_one_root_resolves_exact_handler_path", () => {
    const root = "/home/zhaoge/workspace/opencode/work-one";
    expect(resolveSkillSummaryModulePath(root)).toBe(join(root, ".opencode", "plugin-handlers", "system", "skill-summary.ts"));
  });

  test("empty_or_relative_root_rejected_before_dynamic_import", () => {
    expect(() => resolveSkillSummaryModulePath("")).toThrow("OPENCODE_ROOT");
    expect(() => resolveSkillSummaryModulePath("opencode/work-one")).toThrow("OPENCODE_ROOT");
  });

  test("resolved_path_has_no_worktree_relative_dependency", () => {
    const root = "/tmp/explicit-opencode-root";
    const resolved = resolveSkillSummaryModulePath(root);
    expect(resolved.startsWith(`${root}/`)).toBe(true);
    expect(resolved).not.toContain("qoderwork/.worktrees");
  });
});
