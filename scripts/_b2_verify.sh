#!/usr/bin/env bash
set -u
BUN=/home/zhaoge/.bun/bin/bun
SCR=/home/zhaoge/workspace/qoderwork/scripts
ROOT=ses_0b2c11a8bffeySavHyl3va4pBM
cd "$SCR"
for MODE in 404 html nonjson; do
  B2_MODE=$MODE B2_PORT=5098 "$BUN" run _b2_children_proxy.ts >/tmp/p.log 2>&1 &
  PID=$!
  sleep 2
  CODE=$(curl -s -o /tmp/body.txt -w "%{http_code}" -m 4 "http://127.0.0.1:5098/session/$ROOT/children")
  CT=$(curl -s -o /dev/null -w "%{content_type}" -m 4 "http://127.0.0.1:5098/session/$ROOT/children")
  echo "MODE=$MODE -> HTTP $CODE | CT=$CT | body=$(head -c 40 /tmp/body.txt)"
  kill $PID 2>/dev/null; wait $PID 2>/dev/null
done
echo "--- node-info forwarded? ---"
B2_MODE=404 B2_PORT=5098 "$BUN" run _b2_children_proxy.ts >/tmp/p.log 2>&1 &
PID=$!; sleep 2
curl -s -o /tmp/ni.txt -w "node-info HTTP %{http_code}\n" -m 4 "http://127.0.0.1:5098/session/$ROOT"
echo "body: $(head -c 80 /tmp/ni.txt)"
kill $PID 2>/dev/null; wait $PID 2>/dev/null
