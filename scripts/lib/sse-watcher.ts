import * as fs from "node:fs";
import { spawn } from "node:child_process";

/**
 * SSEWatcherFd — Scheme A: persistent fd + fstatSync + pread
 *
 * 设计要点:
 *   - 持有持久化 fd，避免每次 open/close
 *   - fstatSync(fd) 绕过 WSL VFS path cache（直接查 inode）
 *   - inode 校验：log rotation 时自动 reopen
 *   - 跨 poll 保留 partial line（处理 daemon 写半行的情况）
 */
export class SSEWatcherFd {
  private fd: number;
  private ino: number;
  private offset: number;
  private path: string;
  private events: any[] = [];
  private partial: string = "";
  readonly kind = "fd";

  constructor(path: string) {
    this.path = path;
    this.fd = fs.openSync(path, "r");
    const st = fs.fstatSync(this.fd);
    this.ino = st.ino;
    this.offset = st.size;
  }

  async poll(ms: number): Promise<any[]> {
    await new Promise((r) => setTimeout(r, ms));
    let st: fs.Stats;
    try {
      st = fs.fstatSync(this.fd);
    } catch {
      this.reopen();
      st = fs.fstatSync(this.fd);
    }
    if (st.ino !== this.ino || st.size < this.offset) {
      this.reopen();
      st = fs.fstatSync(this.fd);
    }
    const delta = st.size - this.offset;
    if (delta <= 0) return [];

    const buf = Buffer.alloc(delta);
    const read = fs.readSync(this.fd, buf, 0, delta, this.offset);
    this.offset += read;

    this.partial += buf.slice(0, read).toString("utf8");
    const lines = this.partial.split("\n");
    this.partial = lines.pop() || "";

    const newEvents: any[] = [];
    for (const line of lines) {
      if (!line) continue;
      try { newEvents.push(JSON.parse(line)); } catch {}
    }
    this.events.push(...newEvents);
    return newEvents;
  }

  private reopen() {
    try { fs.closeSync(this.fd); } catch {}
    this.fd = fs.openSync(this.path, "r");
    const st = fs.fstatSync(this.fd);
    this.ino = st.ino;
    this.offset = st.size;
    this.partial = "";
  }

  close() {
    try { fs.closeSync(this.fd); } catch {}
  }

  all(): any[] { return this.events; }
}

/**
 * SSEWatcherTail — Scheme B: tail -F subprocess
 *
 * 设计要点:
 *   - 用于 > 5MB 大文件，避免每 poll 全量 read
 *   - tail -F 自动处理 log rotation + inode 切换
 *   - stdout 流式接收，按 \n 切分 + partial buffer
 */
export class SSEWatcherTail {
  private proc: ReturnType<typeof spawn>;
  private events: any[] = [];
  private pending: any[] = [];
  private buffer: string = "";
  readonly kind = "tail";

  constructor(path: string) {
    this.proc = spawn("tail", ["-n", "0", "-F", path], {
      stdio: ["ignore", "pipe", "ignore"],
      detached: false,
    });
    this.proc.stdout?.setEncoding("utf8");
    this.proc.stdout?.on("data", (chunk: string) => {
      this.buffer += chunk;
      const lines = this.buffer.split("\n");
      this.buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line) continue;
        try { this.pending.push(JSON.parse(line)); } catch {}
      }
    });
    this.proc.on("error", () => {});
  }

  async poll(ms: number): Promise<any[]> {
    await new Promise((r) => setTimeout(r, ms));
    const out = this.pending;
    this.pending = [];
    this.events.push(...out);
    return out;
  }

  close() {
    try { this.proc.kill("SIGTERM"); } catch {}
  }

  all(): any[] { return this.events; }
}

/**
 * SSEWatcher — 混合策略入口
 *
 * 选择规则:
 *   - 文件 <= sizeThreshold (默认 5MB) → SSEWatcherFd (Scheme A)
 *   - 文件 > sizeThreshold → SSEWatcherTail (Scheme B)
 *   - 统一接口: poll(ms) → new events, all() → 全量, close()
 *
 * 泄漏防护:
 *   - 注册 process.on("exit"|"SIGINT"|"SIGTERM"|"uncaughtException"|"unhandledRejection")
 *   - 进程异常退出时自动 close() fd / kill tail 子进程
 *   - 通过 disableAutoCleanup() 可关闭（如单元测试场景）
 */
export class SSEWatcher {
  private impl: SSEWatcherFd | SSEWatcherTail;
  private cleanupRegistered = false;
  readonly kind: "fd" | "tail";

  constructor(path: string, sizeThreshold = 5 * 1024 * 1024) {
    let size = 0;
    try { size = fs.statSync(path).size; } catch {}
    if (size > sizeThreshold) {
      this.impl = new SSEWatcherTail(path);
    } else {
      this.impl = new SSEWatcherFd(path);
    }
    this.kind = this.impl.kind;
    this.registerCleanup();
  }

  private registerCleanup() {
    if (this.cleanupRegistered) return;
    this.cleanupRegistered = true;
    const self = this;
    const safeClose = () => { try { self.close(); } catch {} };
    process.once("exit", safeClose);
    process.once("SIGINT", safeClose);
    process.once("SIGTERM", safeClose);
    process.once("uncaughtException", (err) => {
      safeClose();
      // Re-throw so the default handler logs + exits (we don't swallow)
      console.error("[SSEWatcher] uncaughtException, fd closed:", err?.message);
      process.exit(1);
    });
    process.once("unhandledRejection", (reason) => {
      safeClose();
      console.error("[SSEWatcher] unhandledRejection, fd closed:", reason);
      process.exit(1);
    });
  }

  /** Disable auto cleanup (e.g., in tests where process lifecycle is managed externally) */
  disableAutoCleanup() {
    this.cleanupRegistered = false;
    // Note: process.removeListener is best-effort; since we used anonymous
    // closures we cannot fully unregister. Callers should prefer explicit close().
  }

  async poll(ms: number): Promise<any[]> { return this.impl.poll(ms); }
  close() { this.impl.close(); }
  all(): any[] { return this.impl.all(); }
}
