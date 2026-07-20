// P0-2 sentinel: 轻量守护进程，在 A/B 双 run 生命周期内持有 marker 与 identity。
//
// 设计约束（来自 PHASE-03 Fixed contract）：
//   1. 环境变量固定：QODERWORK_P0_2_SENTINEL_ID（sentinel 身份标识）
//                   QODERWORK_P0_2_SENTINEL_MARKER_PATH（marker 绝对路径）
//   2. marker 初始内容：{ sentinelId, pid, readyAt }，由 daemon 原子写入
//      orchestrator 在 start-a 后追加 runId/serveUrl/eventFile 完整 identity 字段
//   3. identity 三态：marker + /proc/{pid}/environ 双重校验（返回字符串，非布尔）
//      FOUND       → pid 存活 + environ sentinelId 匹配 + marker identity 字段匹配 runA
//      NOT_FOUND   → 进程不存在(ESRCH) 或 environ/marker 中 sentinelId/pid 不匹配
//      UNAVAILABLE → 证据不可读：pid probe 非 ESRCH 错误(EPERM 等)/environ 不可读/marker 不可读或损坏
//   4. start: spawn 后等待 marker 文件出现 + pid/sentinelId 验证通过
//   5. stop: 验证 identity 后 SIGTERM，最多一次；identity 不匹配时拒绝 stop
//
// 禁止：sleep 假定 ready、重试同一 pid、kill 非本 sentinel 进程

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { RunManifest, SentinelStartResult, P02SentinelMarker, SentinelIdentityState } from "./types";

const SENTINEL_ENV_ID = "QODERWORK_P0_2_SENTINEL_ID";
const SENTINEL_ENV_MARKER = "QODERWORK_P0_2_SENTINEL_MARKER_PATH";

/** Sentinel marker 完整内容（start-a 后由 orchestrator 补齐 identity 字段）。 */
export interface P02SentinelMarkerFull extends P02SentinelMarker {
  runId?: string;
  serveUrl?: string;
  eventFile?: string;
}

/**
 * 默认 sentinel 启动：spawn 当前 bun 进程运行本文件的 sentinel daemon 模式，
 * 等待初始 marker（sentinelId/pid/readyAt）出现后返回。
 */
export async function startSentinel(
  markerPath: string,
  sentinelId: string,
  _runA: RunManifest,
): Promise<SentinelStartResult> {
  mkdirSync(dirname(markerPath), { recursive: true });
  // 先删除可能存在的旧 marker，避免误读
  rmSync(markerPath, { force: true });

  const child = spawn(process.execPath, [import.meta.path, "--sentinel"], {
    detached: true,
    stdio: ["ignore", "ignore", "ignore"],
    env: {
      ...process.env,
      [SENTINEL_ENV_ID]: sentinelId,
      [SENTINEL_ENV_MARKER]: markerPath,
    },
  });
  child.unref();

  const pid = child.pid;
  if (!pid) throw new Error("sentinel spawn failed: no pid");

  // 轮询 marker 文件出现（最多 5 秒）—— 使用 marker 文件作为 ready 信号
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (existsSync(markerPath)) {
      try {
        const marker = JSON.parse(readFileSync(markerPath, "utf8")) as P02SentinelMarker;
        if (marker.sentinelId === sentinelId && marker.pid === pid) {
          return { sentinelId, pid, markerPath };
        }
      } catch {
        // marker 不完整或正在写入，继续等待
      }
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`sentinel failed to become ready (pid=${pid}, marker=${markerPath})`);
}

/**
 * 安全停止 sentinel：先验证 identity（/proc environ sentinelId 匹配），匹配才发送 SIGTERM。
 * identity 不匹配或进程不存在时静默跳过（stop-once 合同由 orchestrator 保证不重复调用）。
 */
export async function stopSentinel(
  pid: number,
  sentinelId: string,
  markerPath: string,
): Promise<void> {
  if (!pid) return;
  if (validateSentinelIdentity(pid, sentinelId, markerPath) !== "FOUND") return;
  try {
    process.kill(pid, "SIGTERM");
  } catch (e) {
    // 仅 ESRCH（进程已退出）可忽略；其余信号错误（EACCES/EPERM 等）必须 fail-closed 传播，不得静默吞掉
    if ((e as NodeJS.ErrnoException).code === "ESRCH") return;
    throw e;
  }
  // 等待进程实际退出，避免 verify-cleanup 观测到仍存活的竞态
  await waitForExit(pid, 5000);
}

async function waitForExit(pid: number, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      process.kill(pid, 0); // 探测存活
    } catch {
      return; // ESRCH = 已退出
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  // 超时后不 throw（fail-open for cleanup）；verifier 会捕获仍存活的情况
}

/**
 * Sentinel identity 校验：pid 存活 + /proc environ sentinelId 匹配 + marker 中 pid/sentinelId 匹配。
 * 不检查 runId/serveUrl/eventFile（这些由 verify-p02 的 markerIdentityOk 做语义校验）。
 *
 * 三态返回（均为字符串，非布尔）：
 *   FOUND       → pid 存活 + environ sentinelId 匹配 + marker pid/sentinelId 匹配
 *   NOT_FOUND   → pid 不存在(ESRCH) 或 environ/marker 中 sentinelId/pid 不匹配
 *   UNAVAILABLE → 证据不可读：pid probe 非 ESRCH 错误(EPERM 等)/environ 不可读/marker 不可读或损坏
 *
 * @param pidProbe 可选的 pid 探测注入（默认 process.kill(pid, 0)），仅用于测试复现 ESRCH/EPERM 区分。
 */
export function validateSentinelIdentity(
  pid: number,
  sentinelId: string,
  markerPath: string,
  pidProbe?: (pid: number) => void,
): SentinelIdentityState {
  const probe = pidProbe ?? ((p: number) => process.kill(p, 0));
  // 1. pid 存活探测：ESRCH=进程不存在 → NOT_FOUND；其他 probe 错误(EPERM 等) → 证据不可用 UNAVAILABLE
  try {
    probe(pid);
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === "ESRCH") return "NOT_FOUND";
    return "UNAVAILABLE";
  }
  // 2. /proc environ 中 sentinelId 匹配：不匹配本 sentinel → NOT_FOUND
  let environ: string;
  try {
    environ = readFileSync(`/proc/${pid}/environ`).toString("utf8");
  } catch {
    return "UNAVAILABLE"; // 证据不可读，无法判定
  }
  if (!environ.includes(`${SENTINEL_ENV_ID}=${sentinelId}`)) return "NOT_FOUND";
  // 3. marker 可读且 sentinelId/pid 匹配：读不到/损坏 → UNAVAILABLE
  try {
    const marker = JSON.parse(readFileSync(markerPath, "utf8")) as P02SentinelMarker;
    if (marker.sentinelId !== sentinelId || marker.pid !== pid) return "NOT_FOUND";
  } catch {
    return "UNAVAILABLE";
  }
  return "FOUND";
}

/**
 * 在 start-a 成功后，将 runA 的完整 identity 字段写入 sentinel marker，
 * 使 verify-p02 的 markerIdentityOk 检查能够通过。
 */
export function finalizeSentinelMarker(
  markerPath: string,
  runA: RunManifest,
): void {
  const existing = JSON.parse(readFileSync(markerPath, "utf8")) as P02SentinelMarker;
  const full: P02SentinelMarkerFull = {
    ...existing,
    runId: runA.runId,
    serveUrl: `http://127.0.0.1:${runA.port}`,
    eventFile: runA.paths.eventFilePath,
  };
  const tmp = `${markerPath}.tmp`;
  writeFileSync(tmp, JSON.stringify(full, null, 2) + "\n");
  renameSync(tmp, markerPath);
}

// ====== Sentinel daemon entry point ======
// 当本文件以 `bun run p02-sentinel.ts --sentinel` 启动时进入 daemon 模式。
// 写入初始 marker → 等待 SIGTERM/SIGINT → 正常退出（marker 保留供 verifier 读取）。

if (process.argv.includes("--sentinel")) {
  runSentinelDaemon();
}

function runSentinelDaemon(): void {
  const sentinelId = process.env[SENTINEL_ENV_ID];
  const markerPath = process.env[SENTINEL_ENV_MARKER];
  if (!sentinelId || !markerPath) {
    process.stderr.write(`sentinel: missing required env ${SENTINEL_ENV_ID} or ${SENTINEL_ENV_MARKER}\n`);
    process.exit(1);
  }

  const pid = process.pid;
  const marker: P02SentinelMarker = {
    sentinelId,
    pid,
    readyAt: new Date().toISOString(),
  };

  // 原子写入初始 marker（仅 sentinelId/pid/readyAt）
  const tmp = `${markerPath}.tmp`;
  mkdirSync(dirname(markerPath), { recursive: true });
  writeFileSync(tmp, JSON.stringify(marker, null, 2) + "\n");
  renameSync(tmp, markerPath);

  // 信号处理：SIGTERM/SIGINT → 正常退出（marker 保留）
  const exit = () => {
    process.exit(0);
  };
  process.on("SIGTERM", exit);
  process.on("SIGINT", exit);

  // 保持进程存活
  setInterval(() => {
    // no-op; keep event loop alive
  }, 60_000);
}
