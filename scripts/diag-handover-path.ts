import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { resolveWorkspacePaths } from './lib/workspace-paths';
const { workOneRoot } = resolveWorkspacePaths({ env: process.env });

const { getDb } = await (async () => {
  const target = pathToFileURL(resolve(workOneRoot, '.opencode/lib/db-manager.ts')).href;
  return await import(target);
})();

const WORK_ONE_ROOT =
  process.env.OPENCODE_ROOT || '${WORK_ONE_ROOT}';
const GATE_A = 'cg_ses_1783657767464';
const GATE_B = 'cg_ses_1783657987555';

const db = getDb();
const rows = db.query('SELECT session_id, task_id, child_opencode_session_id, parent_opencode_session_id, status AS gate_status, submitted_deliverables, declared_deliverables, agent FROM gate_sessions WHERE session_id IN (?,?)').all(GATE_A, GATE_B) as any[];

for (const r of rows) {
  console.log('==== ' + r.session_id + ' ====');
  console.log('  task_id=' + r.task_id);
  console.log('  agent=' + r.agent);
  console.log('  gate_status=' + r.gate_status);
  console.log('  child=' + r.child_opencode_session_id + ' parent=' + r.parent_opencode_session_id);
  let dd: any[] = [];
  try { dd = JSON.parse(r.declared_deliverables || '[]'); } catch {}
  console.log('  declared_deliverables=' + JSON.stringify(dd, null, 2));

  // Replicate service approve path resolution
  const taskId = r.task_id;
  const handoverEntry = dd.find((d: any) => d.name === 'HANDOVER.md');
  const handoverPath = (handoverEntry && handoverEntry.artifact_path) || `.task_temp/${taskId}/HANDOVER.md`;
  const resolvedHandoverPath = path.resolve(WORK_ONE_ROOT, handoverPath);
  console.log('  >> APPROVE resolves handoverPath=' + handoverPath);
  console.log('  >> APPROVE resolvedHandoverPath=' + resolvedHandoverPath);
  let content = '';
  try { if (fs.existsSync(resolvedHandoverPath)) content = fs.readFileSync(resolvedHandoverPath, 'utf8'); } catch {}
  console.log('  >> APPROVE handoverContent length=' + content.length + ' sha=' + (content ? crypto.createHash('sha256').update(content).digest('hex') : '(empty)'));

  // Replicate submit path resolution (taskId || gateSessionId)
  const taskId2 = r.task_id || r.session_id;
  const taskDir = path.resolve(WORK_ONE_ROOT, '.task_temp', taskId2);
  console.log('  >> SUBMIT taskDir=' + taskDir + ' exists=' + fs.existsSync(taskDir));
  if (fs.existsSync(taskDir)) {
    console.log('  >> SUBMIT HANDOVER.md exists=' + fs.existsSync(path.join(taskDir, 'HANDOVER.md')));
    console.log('  >> SUBMIT TASK_LOG.md exists=' + fs.existsSync(path.join(taskDir, 'TASK_LOG.md')));
    const c2 = fs.readFileSync(path.join(taskDir, 'HANDOVER.md'), 'utf8');
    console.log('  >> SUBMIT HANDOVER.md sha=' + crypto.createHash('sha256').update(c2).digest('hex'));
  }
  console.log('');
}
