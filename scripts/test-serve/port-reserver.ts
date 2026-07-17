#!/usr/bin/env bun
/**
 * Port reservation daemon for test-serve.
 *
 * Usage: bun run port-reserver.ts <port>
 *
 * Protocol:
 *   - binds 127.0.0.1:<port> with net.Server.listen()
 *   - writes "READY\n" to stdout when listening succeeds
 *   - writes "PORT_RESERVER_ERROR:<msg>\n" to stderr and exits 1 on failure
 *   - on SIGTERM: closes the socket, exits 0 (releases port for takeover)
 *   - exits forcibly after 2 seconds if close() hangs
 */
import net from 'node:net';

const portArg = Number(process.argv[2]);
if(!Number.isInteger(portArg) || portArg < 1024 || portArg > 65535){
  process.stderr.write(`PORT_RESERVER_ERROR:invalid port: ${process.argv[2]}\n`);
  process.exit(1);
}

const server = net.createServer();

server.on("error", (err: NodeJS.ErrnoException) => {
  // 端口已被占用，无法完成守护使命
  process.stderr.write(`PORT_RESERVER_ERROR:${err.code ?? "UNKNOWN"}:${err.message}\n`);
  process.exit(1);
});

server.listen(portArg, "127.0.0.1", () => {
  // 通知父进程：端口已占用
  process.stdout.write("READY\n");
});

let closed = false;
// 收到 SIGTERM 时优雅关闭，释放端口
function gracefulShutdown(): void {
  if(closed) return;
  closed = true;
  server.close(() => {
    process.exit(0);
  });

  // 兜底：1 秒后强制退出
  setTimeout(() => process.exit(0), 1000).unref();
}

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

// Safety: auto-exit if parent disconnects (detacthed orphan detection)
process.on("disconnect", gracefulShutdown);
