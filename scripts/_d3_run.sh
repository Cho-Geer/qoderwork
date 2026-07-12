#!/usr/bin/env bash
set -u
PORT=4096
BASE=http://127.0.0.1:$PORT
W=/home/zhaoge/workspace/opencode/work-one
CT='Content-Type: application/json'

echo "=== create session ==="
RESP=$(curl -s -X POST "$BASE/session" -H "$CT" -d '{"title":"D3-governance-e2e","agent":"Orchestrator"}')
echo "$RESP"
SID=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))")
echo "SID=$SID"

echo "=== send git status (read -> allow) ==="
curl -s -m 180 -X POST "$BASE/session/$SID/message" -H "$CT" \
  -d '{"parts":[{"type":"text","text":"Use the safe_shell tool to run EXACTLY this command and report the raw output verbatim: git -C /home/zhaoge/workspace/opencode/work-one status --short"}]}' > /tmp/d3_reply1.txt 2>&1
echo "reply1 bytes: $(wc -c < /tmp/d3_reply1.txt)"; head -c 200 /tmp/d3_reply1.txt; echo

echo "=== send git commit --allow-empty (write -> block) ==="
curl -s -m 180 -X POST "$BASE/session/$SID/message" -H "$CT" \
  -d '{"parts":[{"type":"text","text":"Use the safe_shell tool to run EXACTLY this command and report what the tool returns verbatim: git -C /home/zhaoge/workspace/opencode/work-one commit --allow-empty -m d3-block-test"}]}' > /tmp/d3_reply2.txt 2>&1
echo "reply2 bytes: $(wc -c < /tmp/d3_reply2.txt)"; head -c 200 /tmp/d3_reply2.txt; echo

sleep 3

echo "=== locate governance logs ==="
GOVLOG=$(find "$W" -path '*/node_modules' -prune -o -name 'plugin-tool-governance-runtime.log' -print 2>/dev/null | head -1)
AUDIT=$(find "$W" -path '*/node_modules' -prune -o -name 'audit.jsonl' -print 2>/dev/null | head -1)
echo "GOVLOG=$GOVLOG"
echo "AUDIT=$AUDIT"

echo "=== GOVERNANCE-ALLOW for SID ==="
grep -h "$SID" "$GOVLOG" 2>/dev/null | grep -i "GOVERNANCE-ALLOW" | head -5
echo "=== GOVERNANCE-BLOCK for SID ==="
grep -h "$SID" "$GOVLOG" 2>/dev/null | grep -i "GOVERNANCE-BLOCK" | head -5
echo "=== audit.jsonl governance rows for SID ==="
grep -h "$SID" "$AUDIT" 2>/dev/null | grep -i "governance" | head -5
echo "DONE SID=$SID"
