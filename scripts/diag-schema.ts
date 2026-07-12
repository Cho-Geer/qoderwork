import { getDb } from '/home/zhaoge/workspace/opencode/work-one/.opencode/lib/db-manager';
const db = getDb();
console.log('=== gate_sessions columns ===');
const cols = db.query('PRAGMA table_info(gate_sessions)').all() as any[];
for (const c of cols) console.log('  ' + c.name + ' ' + c.type);
console.log('=== sample row (GATE_A) ===');
const row = db.query('SELECT * FROM gate_sessions WHERE session_id = ?').get('cg_ses_1783657767464') as any;
if (!row) { console.log('  (no row)'); }
else {
  for (const k of Object.keys(row)) {
    let v = row[k];
    if (typeof v === 'string' && v.length > 200) v = v.slice(0,200) + '…[' + v.length + ']';
    console.log('  ' + k + ' = ' + JSON.stringify(v));
  }
}
console.log('=== gate_call_context columns ===');
const cols2 = db.query('PRAGMA table_info(gate_call_context)').all() as any[];
for (const c of cols2) console.log('  ' + c.name + ' ' + c.type);
