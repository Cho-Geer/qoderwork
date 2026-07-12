#!/usr/bin/env bash
set -u
BASE=http://127.0.0.1:4096
CREATE=$(curl -s -m 5 -X POST "$BASE/session" -H "Content-Type: application/json" -d '{"agent":"Orchestrator"}')
echo "CREATE_JSON: $CREATE"
SID=$(echo "$CREATE" | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
echo "SID=$SID"
echo "=== POST message (headers+body, raw) ==="
curl -s -m 90 -i -X POST "$BASE/session/$SID/message" -H "Content-Type: application/json" -d '{"parts":[{"type":"text","text":"What is 2+2? Reply in one short sentence."}]}' | head -c 2500
echo ""
echo "=== wait 5s for hook+LLM ==="
sleep 5
echo "=== skill-summary log tail (today) ==="
tail -n 15 /home/zhaoge/workspace/opencode/work-one/.task_temp/_logs/2026-07-11/plugin-skill-summary-runtime.log 2>/dev/null
echo "=== session messages (raw) ==="
curl -s -m 5 "$BASE/session/$SID" 2>&1 | head -c 2000
