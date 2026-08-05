#!/usr/bin/env bash
set -u
BUN=${HOME}/.bun/bin/bun
SCRIPTS=${QODERWORK_ROOT}/scripts
ROOT=ses_0b2c11a8bffeySavHyl3va4pBM
PORT=5097

cd "$SCRIPTS"

echo "=== CLEAN (real serve 4096) ==="
SERVE_URL=http://127.0.0.1:4096 "$BUN" run session-tree.ts "$ROOT" --json > /tmp/tree_clean.json 2>/tmp/clean.err
echo "clean exit=$? bytes=$(wc -c < /tmp/tree_clean.json)"

for MODE in 404 html nonjson; do
  echo "=== MODE=$MODE ==="
  B2_MODE=$MODE B2_PORT=$PORT "$BUN" run _b2_children_proxy.ts >/tmp/proxy_$MODE.log 2>&1 &
  PID=$!
  sleep 1
  SERVE_URL=http://127.0.0.1:$PORT "$BUN" run session-tree.ts "$ROOT" --json > /tmp/tree_$MODE.json 2>/tmp/$MODE.err
  echo "$MODE exit=$? bytes=$(wc -c < /tmp/tree_$MODE.json)"
  kill $PID 2>/dev/null
  wait $PID 2>/dev/null
done

echo "=== COMPARE ==="
python3 - "$ROOT" <<'PY'
import json, sys
root=sys.argv[1]
def load(p):
    try:
        return json.load(open(p))
    except Exception as e:
        return {"_err": str(e)}
clean=load("/tmp/tree_clean.json")
modes={m: load(f"/tmp/tree_{m}.json") for m in ("404","html","nonjson")}
def key(t):
    if "_err" in t: return ("ERR", t["_err"])
    nodes=t.get("nodes",{})
    sig={}
    for sid,n in nodes.items():
        sig[sid]=(n.get("agent"), tuple(sorted(n.get("children",[]))))
    return (tuple(sorted(t.get("allIds",[]))), tuple(sorted(t.get("leafIds",[]))), tuple(sorted(sig.items())))
kc=key(clean)
print("clean allIds:", len(clean.get("allIds",[])), "leafIds:", len(clean.get("leafIds",[])), "nodes:", len(clean.get("nodes",{})))
allmatch=True
for m in ("404","html","nonjson"):
    km=key(modes[m])
    ok = (km==kc)
    print(f"mode {m}: allIds={len(modes[m].get('allIds',[]))} leafIds={len(modes[m].get('leafIds',[]))} nodes={len(modes[m].get('nodes',{}))} match_clean={ok}")
    allmatch = allmatch and ok
print("ALL_FAULT_MODES_MATCH_CLEAN:", allmatch)
PY
