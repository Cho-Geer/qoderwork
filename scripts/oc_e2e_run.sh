#!/usr/bin/env bash
# OpenCode serve-API E2E driver. Creates a real Orchestrator session,
# sends one prompt, captures the raw SSE stream + parsed artifacts.
set -uo pipefail
BASE="http://127.0.0.1:4096"
EVID="/home/zhaoge/workspace/qoderwork/e2e-evidence"
CASE="${1:?usage: oc_e2e_run.sh <case_id> <prompt_text> [timeout_sec]}"
PROMPT="${2:?prompt required}"
TIMEOUT="${3:-180}"
mkdir -p "$EVID/$CASE"
cd /home/zhaoge/workspace/opencode/work-one || { echo "cd failed"; exit 1; }

echo "[$(date -u +%FT%TZ)] case=$CASE" | tee "$EVID/$CASE/meta.txt"
CREATE=$(curl -s -m 30 -X POST "$BASE/session" -H "Content-Type: application/json" -d '{"directory":"/home/zhaoge/workspace/opencode/work-one","agent":"Orchestrator"}')
printf '%s\n' "$CREATE" > "$EVID/$CASE/create.json"
SID=$(printf '%s' "$CREATE" | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d.get("id",""))' 2>/dev/null)
echo "SID=$SID" | tee -a "$EVID/$CASE/meta.txt"
if [ -z "$SID" ]; then echo "NO SID — create failed"; cat "$EVID/$CASE/create.json"; exit 2; fi

ENC=$(python3 -c 'import sys,json;print(json.dumps(sys.argv[1]))' "$PROMPT")
echo "[$(date -u +%FT%TZ)] sending message (timeout ${TIMEOUT}s)" | tee -a "$EVID/$CASE/meta.txt"
curl -s -m "$TIMEOUT" -N -X POST "$BASE/session/$SID/message" \
  -H "Content-Type: application/json" \
  -d "{\"parts\":[{\"type\":\"text\",\"text\":$ENC}]}" > "$EVID/$CASE/stream.sse" 2>&1
echo "[$(date -u +%FT%TZ)] stream bytes: $(wc -c < "$EVID/$CASE/stream.sse")" | tee -a "$EVID/$CASE/meta.txt"

# capture children tree (observability)
curl -s -m 10 "$BASE/session/$SID/children" > "$EVID/$CASE/children.json" 2>&1
echo "children http: $(wc -c < "$EVID/$CASE/children.json") bytes" | tee -a "$EVID/$CASE/meta.txt"
echo "DONE case=$CASE SID=$SID"
