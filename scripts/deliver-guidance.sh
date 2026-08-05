#!/bin/bash
# QoderWork 指导下发脚本 — 直写 DB，零 MCP 依赖
DB_PATH="${WORK_ONE_ROOT}/.opencode/state/framework-state.db"
SESSION_ID="$1"
GUIDANCE_TEXT="$2"
if [ -z "$SESSION_ID" ] || [ -z "$GUIDANCE_TEXT" ]; then
  echo "Usage: $0 <session_id> <guidance_text>"
  exit 1
fi
NOW=$(date +%s%3N)
sqlite3 "$DB_PATH" \
  "UPDATE tool_enforcement SET
     guidance_text = '${GUIDANCE_TEXT//\'/\'\'}',
     guidance_requested_at = ${NOW},
     awaiting_guidance = 1,
     updated_at = ${NOW}
   WHERE session_id = '${SESSION_ID}'"
echo "Guidance delivered to session $SESSION_ID"
