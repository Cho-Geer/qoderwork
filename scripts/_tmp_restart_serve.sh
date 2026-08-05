#!/bin/bash
export PATH="${HOME}/.local/bin:/usr/local/bin:/usr/bin:/bin:${HOME}/.bun/bin"
set -e

echo "=== [1/3] clean bun cache ==="
rm -rf ${HOME}/.bun/install/cache
echo "bun cache removed"

echo "=== [2/3] kill existing opencode serve (PID 2580730 + group) ==="
kill 2580730 2>/dev/null || true
pkill -P 2580730 2>/dev/null || true
pkill -f 'opencode serve --port 4096' 2>/dev/null || true
sleep 3
echo "remaining serve procs:"
ps aux | grep 'opencode serve' | grep -v grep | wc -l

echo "=== [3/3] start serve fresh from work-one (loads instrumented skill-summary.ts) ==="
cd ${WORK_ONE_ROOT}
LOG=${WORK_ONE_ROOT}/.task_temp/_logs/serve-restart.log
: > "$LOG"
setsid nohup ${HOME}/.opencode/bin/opencode serve --port 4096 > "$LOG" 2>&1 &
disown
echo "serve launch pid (setsid child): $!"

# wait for bind
for i in $(seq 1 15); do
  code=$(curl -s -m 3 -o /dev/null -w '%{http_code}' http://127.0.0.1:4096/session 2>/dev/null || echo 000)
  if [ "$code" = "200" ]; then
    echo "serve healthy after ${i}s (HTTP 200)"
    break
  fi
  sleep 1
done
echo "--- tail serve-restart.log ---"
tail -20 "$LOG"
