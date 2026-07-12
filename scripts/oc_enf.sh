#!/usr/bin/env bash
# Dump recent rows from key enforcement/observability tables in framework-state.db.
set -uo pipefail
DB="/home/zhaoge/workspace/opencode/work-one/.opencode/state/framework-state.db"
SID="${1:-}"
python3 - "$DB" "$SID" <<'PY'
import sys, sqlite3
db, sid = sys.argv[1], sys.argv[2]
con = sqlite3.connect(db); con.row_factory = sqlite3.Row
tables = ["tool_enforcement","tool_guidance_state","soft_rejections",
          "repo_operation_events","repo_operation_grants","dispatch_queue",
          "dispatch_privilege_grants","session_events","session_log",
          "execution_checklist_items","framework_maintenance_plans",
          "read_audit","audit_log","audit_trail","dispatch_attempts"]
for t in tables:
    try:
        cur = con.execute(f"select * from {t} order by rowid desc limit 30")
        rows = cur.fetchall()
        if not rows:
            print(f"\n## {t}: (empty)"); continue
        cols = [d[0] for d in cur.description]
        sids = [c for c in cols if 'session' in c.lower() or c in ('sid','id')]
        print(f"\n## {t} (last {len(rows)}): cols={cols}")
        for r in rows:
            d = dict(r)
            if sid and sids:
                if not any(str(d.get(c,'')).find(sid)>=0 for c in sids):
                    continue
            d = {k:(str(v)[:140]) for k,v in d.items()}
            print("   ", d)
    except Exception as e:
        print(f"\n## {t}: ERR {e}")
PY
