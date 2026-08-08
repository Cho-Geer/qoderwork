// scripts/task-lens/__tests__/cli-path-validation.test.ts
// Regression coverage for POSIX and Windows absolute CLI paths.

import { describe, expect, test } from "bun:test";
import { isAbsolutePath } from "../cli.ts";

describe("task-lens CLI absolute path validation", () => {
  test("accepts POSIX and Windows absolute paths", () => {
    expect(isAbsolutePath("/foo/bar")).toBe(true);
    expect(isAbsolutePath("C:/foo/bar")).toBe(true);
    expect(isAbsolutePath("C:\\foo\\bar")).toBe(true);
  });

  test("rejects relative paths", () => {
    expect(isAbsolutePath("./foo/bar")).toBe(false);
    expect(isAbsolutePath("foo/bar")).toBe(false);
  });
});
