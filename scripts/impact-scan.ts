#!/usr/bin/env bun
// impact-scan.ts - 共享函数影响面扫描工具
//
// 用法:
//   bun run scripts/impact-scan.ts --functions setRunState,writeRunManifest
//   bun run scripts/impact-scan.ts --functions setRunState --output impact-report.json
//
// 输出 JSON:
// {
//   "scanned_functions": ["setRunState"],
//   "shared_functions": ["setRunState"],
//   "caller_files": ["scripts/test-serve/bootstrap.ts", ...],
//   "caller_tests": ["scripts/test-serve/__tests__/bootstrap.test.ts", ...],
//   "scan_output_sha256": "..."
// }

import { createHash } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

interface ImpactReport {
  scanned_functions: string[];
  shared_functions: string[];
  caller_files: string[];
  caller_tests: string[];
  scan_output_sha256: string;
}

export function runCodegraphCallers(functionName: string): string {
  const result = Bun.spawnSync({
    cmd: ["codegraph", "callers", functionName],
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode !== 0) {
    const rgResult = Bun.spawnSync({
      cmd: ["rg", "-n", functionName, "scripts/"],
      stdout: "pipe",
      stderr: "pipe",
    });
    return rgResult.stdout.toString();
  }
  return result.stdout.toString();
}

export function parseCallerFiles(scanOutput: string): string[] {
  const files = new Set<string>();
  for (const line of scanOutput.split("\n")) {
    // Match a `scripts/...ts` path token anywhere in the line. The regex is
    // intentionally unanchored: real `codegraph callers` output wraps paths in
    // ANSI escapes and may place them after a symbol name, while `rg` and test
    // fixtures use other layouts. `[^\s]+` backtracks to the final `.ts`, so a
    // trailing `:line` (or ANSI reset) is left unmatched.
    const match = line.match(/(scripts\/[^\s]+\.ts)/);
    if (match) {
      files.add(match[1]);
    }
  }
  return [...files].sort();
}

export function findTestFile(sourceFile: string): string | null {
  const dir = dirname(sourceFile);
  const base = sourceFile.split("/").pop()!.replace(".ts", ".test.ts");
  const testPath = join(dir, "__tests__", base);
  return existsSync(testPath) ? testPath : null;
}

export function identifySharedFunctions(
  functions: string[],
  allCallerFiles: Set<string>,
  sharedFunctions: string[],
  combinedOutput: string,
): ImpactReport {
  for (const func of functions) {
    const output = runCodegraphCallers(func);
    combinedOutput += output;
    const callers = parseCallerFiles(output);
    const externalCallers = callers.filter((f) => !f.endsWith(`/${func}.ts`));
    if (externalCallers.length >= 2) {
      sharedFunctions.push(func);
      externalCallers.forEach((f) => allCallerFiles.add(f));
    }
  }

  const allCallerTests = new Set<string>();
  for (const file of allCallerFiles) {
    const testFile = findTestFile(file);
    if (testFile) allCallerTests.add(testFile);
  }

  return {
    scanned_functions: functions,
    shared_functions: sharedFunctions,
    caller_files: [...allCallerFiles].sort(),
    caller_tests: [...allCallerTests].sort(),
    scan_output_sha256: createHash("sha256").update(combinedOutput).digest("hex"),
  };
}

function main(): void {
  const funcsIndex = process.argv.indexOf("--functions");
  if (funcsIndex < 0 || !process.argv[funcsIndex + 1]) {
    console.error("Usage: impact-scan.ts --functions <comma-separated>");
    process.exit(1);
  }
  const functions = process.argv[funcsIndex + 1].split(",").map((f) => f.trim());

  const allCallerFiles = new Set<string>();
  const sharedFunctions: string[] = [];
  let combinedOutput = "";

  const report = identifySharedFunctions(functions, allCallerFiles, sharedFunctions, combinedOutput);

  const outputIndex = process.argv.indexOf("--output");
  if (outputIndex > 0 && process.argv[outputIndex + 1]) {
    writeFileSync(process.argv[outputIndex + 1], JSON.stringify(report, null, 2) + "\n");
  }
  console.log(JSON.stringify(report, null, 2));
}

if (import.meta.main) main();
