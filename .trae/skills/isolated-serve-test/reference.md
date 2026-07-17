# isolated-serve-test reference

## Manifest 关键字段

- `runId`
- `status`
- `commit`
- `port`
- `paths.manifestPath`
- `paths.eventFilePath`
- `paths.frameworkDbPath`
- `paths.opencodeDbPath`
- `rootSessionId`
- `childSessionId`
- `grantId`
- `dispatchKey`
- `allowedPaths`

## 命令模板

```bash
test-serve create --commit <sha> --port <port> --test-id <id>
test-serve start --run-dir <run-dir>
test-serve bootstrap --run-dir <run-dir> --root-agent <agent> --child-agent <agent> --allowed-paths <abs-path>
test-serve execute --run-dir <run-dir> --mode plan --runner <script> -- --run-dir <run-dir>
test-serve stop --run-dir <run-dir>
test-serve cleanup --run-dir <run-dir>
```

## Evidence 目录规则

- run 级 artifact: `${runDir}/artifacts/`
- manifest: `${runDir}/manifest.json`
- serve 日志: `${runDir}/logs/serve.log`
- SSE 日志: `${runDir}/logs/sse.log`
- 事件流: `${runDir}/events/events.jsonl`

## Bootstrap Oracle

bootstrap 成功后必须满足：
- `manifest.childSessionId` 非空
- `manifest.grantId` 非空
- isolated framework DB 中 grant 状态为 `bound`
- `manifest.bootstrapComplete === true`
