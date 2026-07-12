#!/usr/bin/env bash
# Query the framework-state.db. Usage: oc_db.sh "SQL"
set -uo pipefail
DB="/home/zhaoge/workspace/opencode/work-one/.opencode/state/framework-state.db"
SQLF="/tmp/oc_db_query.sql"
printf '%s\n' "$1" > "$SQLF"
python3 - "$DB" "$SQLF" <<'PY'
import sys, sqlite3
db, sqlf = sys.argv[1], sys.argv[2]
sql = open(sqlf).read()
con = sqlite3.connect(db)
con.row_factory = sqlite3.Row
try:
    cur = con.execute(sql)
    if cur.description is None:
        print("OK rows affected:", cur.rowcount)
    else:
        cols = [d[0] for d in cur.description]
        rows = cur.fetchall()
        print("COLUMNS:", cols)
        print("ROWCOUNT:", len(rows))
        for r in rows[:60]:
            print(dict(r))
except Exception as e:
    print("ERR", repr(e))
PY
