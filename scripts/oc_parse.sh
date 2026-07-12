#!/usr/bin/env bash
# Parse a captured serve stream.sse into a readable parts summary.
set -uo pipefail
EVID="/home/zhaoge/workspace/qoderwork/e2e-evidence"
CASE="${1:?case required}"
F="$EVID/$CASE/stream.sse"
[ -f "$F" ] || { echo "no stream for $CASE"; exit 1; }
python3 - "$F" <<'PY'
import sys, json
p=sys.argv[1]
try:
    obj=json.load(open(p))
except Exception as e:
    print("PARSE ERROR", e); sys.exit(1)
info=obj.get("info",{})
print("SESSION:", info.get("sessionID"))
print("MODEL:", info.get("modelID"), "| AGENT:", info.get("agent"), "| FINISH:", info.get("finish"))
parts=obj.get("parts",[])
print("PART COUNT:", len(parts))
for i,part in enumerate(parts):
    if not isinstance(part, dict):
        print(f"[{i}] (non-dict) {part!r}"[:200]); continue
    t=part.get("type")
    keys=list(part.keys())
    if t=="text":
        print(f"[{i}] TEXT: {part.get('text','')[:400]}")
    elif t=="reasoning":
        print(f"[{i}] REASON: {part.get('text','')[:250]}")
    elif "tool" in t.lower() or "invoc" in t.lower():
        tool=part.get("tool", part.get("name", part.get("toolName","?")))
        inp=part.get("input", part.get("params", part.get("arguments", part.get("args",""))))
        print(f"[{i}] {t.upper()}: tool={tool}")
        print(f"      input={json.dumps(inp)[:400]}")
    elif "result" in t.lower():
        out=part.get("output", part.get("result", part.get("content","")))
        s=json.dumps(out) if not isinstance(out,str) else out
        print(f"[{i}] {t.upper()}: {s[:400]}")
    else:
        print(f"[{i}] TYPE={t} keys={keys}")
PY
