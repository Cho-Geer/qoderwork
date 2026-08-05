import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { resolveWorkspacePaths } from './lib/workspace-paths';
const { workOneRoot } = resolveWorkspacePaths({ env: process.env });

const { getDb } = await (async () => {
  const target = pathToFileURL(resolve(workOneRoot, '.opencode/lib/db-manager.ts')).href;
  return await import(target);
})();

const GATE_A = 'cg_ses_1783657767464';
const GATE_B = 'cg_ses_1783657987555';
const A  = 'ses_0b5bb313effeDbHTMEjJbn2PDk';
const B  = 'ses_0b5bb314dffeSrUhp5Ou4F0o57';
const A1 = 'ses_0b5bb310fffeDbRmDULjMY1Tg9';
const B1 = 'ses_0b5bb311cffeLMKPXEdqcChqww';

const db = getDb();

// 1) Purge transient gate_call_context for the test gates + sessions
const cc = db.run(
  'DELETE FROM gate_call_context WHERE gate_session_id IN (?,?) OR opencode_session_id IN (?,?,?,?)',
  [GATE_A, GATE_B, A, B, A1, B1],
);

// 2) Reset the two test gate rows to a neutral, inert, re-runnable state
const gs = db.run(
  `UPDATE gate_sessions SET status='armed', task_id=NULL, declared_deliverables=NULL,
     child_opencode_session_id=NULL, parent_opencode_session_id=NULL,
     last_submit_session_id=NULL, last_approve_session_id=NULL,
     submitted_deliverables=NULL, deliverables_approved_by=NULL, deliverables_approved_at=NULL,
     deliverables_approval_note=NULL, consumed_at=NULL, audit=NULL,
     updated_at=strftime('%s','now')*1000 WHERE session_id IN (?,?)`,
  [GATE_A, GATE_B],
);

// 3) Guarded: remove any session_map rows tied to the test sessions
let smChanges = 0;
try {
  const sm = db.run(
    'DELETE FROM session_map WHERE session_id IN (?,?,?,?) OR parent_id IN (?,?,?,?)',
    [A, B, A1, B1, A, B, A1, B1],
  );
  smChanges = sm.changes;
} catch (e: any) {
  console.log('session_map delete skipped (table may not exist / not used): ' + e.message);
}

console.log('gate_call_context deleted = ' + cc.changes);
console.log('gate_sessions reset       = ' + gs.changes);
console.log('session_map deleted       = ' + smChanges);
console.log('cleanup OK');
