#!/usr/bin/env bash
set -u
BUN=/home/zhaoge/.bun/bin/bun
SCR=/home/zhaoge/workspace/qoderwork/scripts
cd "$SCR"
echo "=== stop serve ==="
"$BUN" run start-serve.ts --stop 2>&1 | tail -5
sleep 2
echo "=== start serve (load new .opencode code) ==="
"$BUN" run start-serve.ts 2>&1 | tail -8
sleep 3
echo "=== verify up ==="
curl -s -m 5 -H 'Content-Type: application/json' http://127.0.0.1:4096/session >/dev/null 2>&1 && echo "SERVE_UP" || echo "SERVE_DOWN"
