// ── Manifest 工厂：从 RunManifest 派生所有客户端参数 ──
// 供 runner 一次性获取 serveUrl / sseFile / worktreeDir / artifactsDir
export interface ServeClientContext {
  serveUrl: string;
  sseFile: string;
  worktreeDir: string;
  artifactsDir: string;
  frameworkDbPath: string;
}