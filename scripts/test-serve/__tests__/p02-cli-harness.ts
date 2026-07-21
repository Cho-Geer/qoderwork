// P0-2 CLI component 测试 harness
//
// 捕获 runTestServeCli 的 stdout/stderr/exitCode，供 p02-cli.test.ts 断言。
// runP02 通过 globalThis.__P02_RUNNER__ 注入 spy（见 p02-cli.test.ts），不触发真实 coordinator。

import { runTestServeCli } from "../isolated-serve";

export interface CliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

const EXIT_SENTINEL = "__CLI_EXIT__";

export async function runCliP02(argv: string[]): Promise<CliResult> {
  const originalLog = console.log;
  const originalError = console.error;
  const originalExit = process.exit;

  let stdout = "";
  let stderr = "";
  let exitCode = 0;

  console.log = (...parts: unknown[]) => {
    stdout += parts.map((p) => (typeof p === "string" ? p : JSON.stringify(p))).join(" ") + "\n";
  };
  console.error = (...parts: unknown[]) => {
    stderr += parts.map((p) => (typeof p === "string" ? p : JSON.stringify(p))).join(" ") + "\n";
  };
  // 拦截 process.exit：记录退出码并抛哨兵错误，打断控制流（不真正退出测试进程）。
  (process.exit as unknown) = (code?: number) => {
    exitCode = code ?? 0;
    throw new Error(`${EXIT_SENTINEL}${exitCode}`);
  };

  try {
    await runTestServeCli(["bun", "isolated-serve", ...argv]);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.startsWith(EXIT_SENTINEL)) {
      exitCode = Number(msg.slice(EXIT_SENTINEL.length));
    } else {
      // main 抛出的校验错误（生产路径由 import.meta.main 转为 process.exit(1)）
      stderr += msg + "\n";
      exitCode = 1;
    }
  } finally {
    console.log = originalLog;
    console.error = originalError;
    process.exit = originalExit;
  }

  return { exitCode, stdout, stderr };
}
