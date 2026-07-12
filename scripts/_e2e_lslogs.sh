#!/usr/bin/env bash
LOGROOT=/home/zhaoge/workspace/opencode/work-one/.task_temp/_logs
echo "=== all log files (any depth) ==="
find "$LOGROOT" -type f 2>/dev/null | sort
echo "=== skill-summary file anywhere? ==="
find "$LOGROOT" -type f -name "*skill-summary*" 2>/dev/null
echo "=== 2026-07-11 dir listing ==="
ls -la "$LOGROOT/2026-07-11" 2>/dev/null
echo "=== audit.jsonl line count ==="
wc -l "$LOGROOT/2026-07-11/audit.jsonl" 2>/dev/null
