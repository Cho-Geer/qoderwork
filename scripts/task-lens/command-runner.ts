// scripts/task-lens/command-runner.ts
// REQ-003-A — safe subprocess execution. Fixed argv, shell=false, minimal env,
// bounded timeout / stdout / stderr, AbortSignal cancellation, process-tree kill.

import {
  type CommandRequest,
  type CommandResult,
  ENV_ALLOWLIST,
  ENV_DENYLIST,
  DEFAULT_TIMEOUT_MS,
  MAX_TIMEOUT_MS,
  DEFAULT_MAX_STDOUT_BYTES,
  DEFAULT_MAX_STDERR_BYTES,
  MAX_STDOUT_BYTES,
  MAX_STDERR_BYTES,
  ProcessFailure,
} from "./types.ts";

// ---------------------------------------------------------------------------
// Env allowlist
// ---------------------------------------------------------------------------

/** Build the minimal env passed to every child. Only allowlisted keys survive. */
export function buildChildEnv(source: NodeJS.ProcessEnv = process.env): {
  env: Record<string, string>;
  keys: readonly string[];
} {
  const env: Record<string, string> = {};
  for (const key of ENV_ALLOWLIST) {
    const v = source[key];
    if (typeof v === "string" && v.length > 0) {
      env[key] = v;
    }
  }
  // Defensive: never carry loader-injection vectors even if somehow present.
  for (const key of ENV_DENYLIST) {
    if (key in env) delete env[key];
  }
  const keys = Object.keys(env).sort();
  return { env, keys };
}

// ---------------------------------------------------------------------------
// Bounded stream reader
// ---------------------------------------------------------------------------

async function readLimited(
  stream: ReadableStream<Uint8Array>,
  limit: number,
  onLimit: () => void,
): Promise<{ text: string; truncated: boolean }> {
  const reader = stream.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  let truncated = false;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      chunks.push(Buffer.from(value));
      total += value.length;
      if (total > limit) {
        truncated = true;
        onLimit();
        break;
      }
    }
  } catch {
    // stream aborted mid-read; whatever was captured is enough
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* noop */
    }
  }
  const merged = Buffer.concat(chunks).subarray(0, limit + 1);
  return { text: merged.toString("utf8"), truncated };
}

function clamp(value: number | undefined, def: number, max: number): number {
  const v = value ?? def;
  if (!Number.isFinite(v) || v <= 0) return def;
  return Math.min(v, max);
}

// ---------------------------------------------------------------------------
// runCommand
// ---------------------------------------------------------------------------

/**
 * Execute a fixed-argv command with shell=false and a minimal env. Returns a
 * CommandResult on success (exit 0, no truncation, no timeout). Throws
 * ProcessFailure (exit 20) for any disallowed executable, non-zero exit,
 * timeout, signal, or output truncation — always terminating the child first.
 */
export async function runCommand(request: CommandRequest): Promise<CommandResult> {
  const executable = request.executable;
  if (executable !== "git" && executable !== "codegraph") {
    const { keys } = buildChildEnv();
    throw new ProcessFailure(
      "DISALLOWED_EXECUTABLE",
      executable,
      request.args,
      keys,
      null,
      null,
      0,
      false,
      false,
      `executable "${executable}" not in allowlist [git, codegraph]`,
    );
  }

  const argv: string[] = [executable, ...request.args];
  const timeoutMs = clamp(request.timeoutMs, DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS);
  const maxOut = clamp(request.maxStdoutBytes, DEFAULT_MAX_STDOUT_BYTES, MAX_STDOUT_BYTES);
  const maxErr = clamp(request.maxStderrBytes, DEFAULT_MAX_STDERR_BYTES, MAX_STDERR_BYTES);
  const { env, keys } = buildChildEnv();

  const controller = new AbortController();
  let timedOut = false;
  let truncated = false;
  let externalAbort = false;

  const timer =
    timeoutMs > 0
      ? setTimeout(() => {
          timedOut = true;
          controller.abort();
        }, timeoutMs)
      : null;

  if (request.signal) {
    if (request.signal.aborted) {
      externalAbort = true;
      controller.abort();
    } else {
      request.signal.addEventListener("abort", () => {
        externalAbort = true;
        controller.abort();
      });
    }
  }

  const start = Date.now();
  // `argv[0]` is the resolved executable; the rest are fixed args. `shell` is
  // never requested — Bun.spawn uses posix_spawn directly (no shell).
  const proc = Bun.spawn(argv, {
    cwd: request.cwd,
    stdout: "pipe",
    stderr: "pipe",
    stdin: request.stdin ?? "ignore",
    env,
    signal: controller.signal,
  });

  const onLimit = () => {
    controller.abort();
    try {
      proc.kill("SIGKILL");
    } catch {
      /* noop */
    }
  };

  let stdoutText = "";
  let stderrText = "";
  let outTruncated = false;
  let errTruncated = false;
  try {
    const [out, err] = await Promise.all([
      readLimited(proc.stdout as ReadableStream<Uint8Array>, maxOut, onLimit),
      readLimited(proc.stderr as ReadableStream<Uint8Array>, maxErr, onLimit),
    ]);
    stdoutText = out.text;
    stderrText = err.text;
    outTruncated = out.truncated;
    errTruncated = err.truncated;
    truncated = outTruncated || errTruncated;
  } catch {
    // streams may throw after abort; ensure child is dead
    try {
      proc.kill("SIGKILL");
    } catch {
      /* noop */
    }
  }

  let exitCode: number;
  try {
    exitCode = await proc.exited;
  } catch {
    exitCode = -1;
  }
  if (timer) clearTimeout(timer);
  const durationMs = Date.now() - start;

  // Classify failure (order matters: explicit aborts before raw exit code).
  if (timedOut) {
    throw new ProcessFailure(
      "TIMEOUT",
      executable,
      request.args,
      keys,
      exitCode,
      null,
      durationMs,
      truncated,
      true,
      stderrText,
    );
  }
  if (truncated) {
    // Truncation always fails, even if the child would have exited 0.
    try {
      proc.kill("SIGKILL");
    } catch {
      /* noop */
    }
    throw new ProcessFailure(
      "TRUNCATED",
      executable,
      request.args,
      keys,
      exitCode,
      null,
      durationMs,
      true,
      false,
      `stdout_truncated=${outTruncated} stderr_truncated=${errTruncated}`,
    );
  }
  if (externalAbort) {
    throw new ProcessFailure(
      "SIGNAL",
      executable,
      request.args,
      keys,
      exitCode,
      "aborted",
      durationMs,
      false,
      false,
      stderrText,
    );
  }
  if (exitCode !== 0) {
    throw new ProcessFailure(
      "NONZERO_EXIT",
      executable,
      request.args,
      keys,
      exitCode,
      null,
      durationMs,
      false,
      false,
      stderrText,
    );
  }

  return {
    executable,
    argv,
    shell: false,
    env: keys,
    exitCode,
    signal: null,
    stdout: stdoutText,
    stderr: stderrText,
    durationMs,
    truncated: false,
    timedOut: false,
  };
}
