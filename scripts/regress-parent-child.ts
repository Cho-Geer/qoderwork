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
const { recordGateCallContext, computeGateArgsHash } = await (async () => {
  const target = pathToFileURL(resolve(workOneRoot, '.opencode/service/gate/session-context-service.ts')).href;
  return await import(target);
})();
const mcpDeliv = await (async () => {
  const target = pathToFileURL(resolve(workOneRoot, '.opencode/service/gate/mcp-deliverables.ts')).href;
  return await import(target);
})();
const { submitDeliverablesWithCrossCheck, approveDeliverablesWithAudit } = mcpDeliv;
type SubmitResult = (typeof mcpDeliv)["SubmitResult"];
type ApproveResult = (typeof mcpDeliv)["ApproveResult"];
const { recordRead } = await (async () => {
  const target = pathToFileURL(resolve(workOneRoot, '.opencode/service/file-guard/read-audit-write.ts')).href;
  return await import(target);
})();

const WORK_ONE_ROOT =
  process.env.OPENCODE_ROOT || '${WORK_ONE_ROOT}';
const GATE_A = 'cg_ses_1783657767464';
const GATE_B = 'cg_ses_1783657987555';
const A  = 'ses_0b5bb313effeDbHTMEjJbn2PDk';  // ParentA
const B  = 'ses_0b5bb314dffeSrUhp5Ou4F0o57';  // ParentB
const A1 = 'ses_0b5bb310fffeDbRmDULjMY1Tg9';   // ChildA1
const B1 = 'ses_0b5bb311cffeLMKPXEdqcChqww';   // ChildB1

function setupGate(g: string, child: string, parent: string) {
  // Mirror real confirm flow: task_id set + declared_deliverables carry artifact_path.
  // (approveDeliverablesWithAudit resolves HANDOVER.md from session.task_id or
  //  declared_deliverables[].artifact_path; submit uses task_id||gateSessionId.
  //  Without these, approve would resolve .task_temp/null/HANDOVER.md -> empty -> spurious reject.)
  const dd = JSON.stringify([
    { name: 'HANDOVER.md', artifact_path: '.task_temp/' + g + '/HANDOVER.md' },
    { name: 'TASK_LOG.md', artifact_path: '.task_temp/' + g + '/TASK_LOG.md' },
  ]);
  getDb().run(
    `UPDATE gate_sessions SET status='armed', task_id=?, declared_deliverables=?, child_opencode_session_id=?, parent_opencode_session_id=?, last_submit_session_id=NULL, last_approve_session_id=NULL, submitted_deliverables=NULL, deliverables_approved_by=NULL, deliverables_approved_at=NULL, deliverables_approval_note=NULL, consumed_at=NULL, updated_at=strftime('%s','now')*1000 WHERE session_id=?`,
    [g, dd, child, parent, g],
  );
}
function resetGates() {
  setupGate(GATE_A, A1, A);
  setupGate(GATE_B, B1, B);
  // Full purge (not just 'pending') so each run is deterministic and the
  // resolveGateCallContextStrict exact-match can't collide with prior-run rows.
  getDb().run('DELETE FROM gate_call_context WHERE gate_session_id IN (?,?) OR opencode_session_id IN (?,?,?,?)', [GATE_A, GATE_B, A, B, A1, B1]);
}
function inject(tool: string, gate: string, sid: string, parent: string, agent: string, rawArgs: Record<string,unknown>) {
  const argsHash = computeGateArgsHash(rawArgs);
  const callId = 'reg_' + tool + '_' + gate + '_' + Date.now() + '_' + Math.random().toString(36).slice(2,8);
  recordGateCallContext({ tool_name: tool, gate_session_id: gate, opencode_session_id: sid, parent_session_id: parent, call_id: callId, agent, args_hash: argsHash });
  return callId;
}
function clearCtx(callId: string) { getDb().run('DELETE FROM gate_call_context WHERE call_id = ?', [callId]); }
function armGate(g: string) { getDb().run("UPDATE gate_sessions SET status='armed', last_submit_session_id=NULL, last_approve_session_id=NULL, submitted_deliverables=NULL, deliverables_approved_by=NULL, deliverables_approved_at=NULL, consumed_at=NULL WHERE session_id=?", [g]); }
function sha256File(p: string) { return crypto.createHash('sha256').update(fs.readFileSync(p,'utf8')).digest('hex'); }
function seedRead(gate: string, agent: string) {
  const p = path.resolve(WORK_ONE_ROOT, '.task_temp/' + gate + '/HANDOVER.md');
  const content = fs.readFileSync(p, 'utf8');
  recordRead({ timestamp: new Date().toISOString(), agent, filePath: p, sessionId: undefined, contentLength: content.length, fileHash: crypto.createHash('sha256').update(content).digest('hex'), fileSize: content.length });
}

const evA = [{name:'HANDOVER.md', artifact_path:'.task_temp/'+GATE_A+'/HANDOVER.md'},{name:'TASK_LOG.md', artifact_path:'.task_temp/'+GATE_A+'/TASK_LOG.md'}];
const evB = [{name:'HANDOVER.md', artifact_path:'.task_temp/'+GATE_B+'/HANDOVER.md'},{name:'TASK_LOG.md', artifact_path:'.task_temp/'+GATE_B+'/TASK_LOG.md'}];

const results: {name:string; pass:boolean; detail:string}[] = [];
function record(name: string, pass: boolean, detail: string) {
  results.push({name, pass, detail});
  console.log((pass?'PASS':'FAIL') + '  ' + name + '  -- ' + detail);
}

resetGates();

// T1 POS submit gateA by correct child A1
let cid = inject('compliance_gate_submit_deliverables', GATE_A, A1, A, 'build', {session_id:GATE_A, step:'submitA1'});
let r: SubmitResult | ApproveResult = submitDeliverablesWithCrossCheck(GATE_A, evA as any, {session_id:GATE_A, step:'submitA1'} as any);
clearCtx(cid);
record('T1 POS submit gateA by child A1', r.status==='delivered', 'status='+r.status+' reason='+(r.reason||''));

// T2 NEG submit gateA by wrong child B1
armGate(GATE_A);
cid = inject('compliance_gate_submit_deliverables', GATE_A, B1, B, 'build', {session_id:GATE_A, step:'submitB1wrong'});
r = submitDeliverablesWithCrossCheck(GATE_A, evA as any, {session_id:GATE_A, step:'submitB1wrong'} as any);
clearCtx(cid);
record('T2 NEG submit gateA by wrong child B1', r.status==='rejected' && /Submit caller mismatch/.test(r.reason||''), 'status='+r.status+' reason='+(r.reason||''));

// T3 POS submit gateB by correct child B1
cid = inject('compliance_gate_submit_deliverables', GATE_B, B1, B, 'build', {session_id:GATE_B, step:'submitB1'});
r = submitDeliverablesWithCrossCheck(GATE_B, evB as any, {session_id:GATE_B, step:'submitB1'} as any);
clearCtx(cid);
record('T3 POS submit gateB by child B1', r.status==='delivered', 'status='+r.status+' reason='+(r.reason||''));

// T4 NEG approve gateA by wrong parent B (privileged Orchestrator)
cid = inject('compliance_gate_approve_deliverables', GATE_A, B, B, 'Orchestrator', {session_id:GATE_A, decision:'approve'});
r = approveDeliverablesWithAudit(GATE_A, 'approve', 'wrong parent probe', 'probe', 'Orchestrator', '', undefined, {session_id:GATE_A, decision:'approve'} as any);
clearCtx(cid);
record('T4 NEG approve gateA by wrong parent B', r.status==='rejected' && /Approve caller mismatch/.test(r.reason||''), 'status='+r.status+' reason='+(r.reason||''));

// T7 NEG approve gateB by parent A (cross-gate)
cid = inject('compliance_gate_approve_deliverables', GATE_B, A, A, 'Orchestrator', {session_id:GATE_B, decision:'approve'});
r = approveDeliverablesWithAudit(GATE_B, 'approve', 'cross probe', 'probe', 'Orchestrator', '', undefined, {session_id:GATE_B, decision:'approve'} as any);
clearCtx(cid);
record('T7 NEG approve gateB by parent A (cross-gate)', r.status==='rejected' && /Approve caller mismatch/.test(r.reason||''), 'status='+r.status+' reason='+(r.reason||''));

// T8 NEG approve gateA by parent B (cross-gate)
cid = inject('compliance_gate_approve_deliverables', GATE_A, B, B, 'Orchestrator', {session_id:GATE_A, decision:'approve'});
r = approveDeliverablesWithAudit(GATE_A, 'approve', 'cross probe', 'probe', 'Orchestrator', '', undefined, {session_id:GATE_A, decision:'approve'} as any);
clearCtx(cid);
record('T8 NEG approve gateA by parent B (cross-gate)', r.status==='rejected' && /Approve caller mismatch/.test(r.reason||''), 'status='+r.status+' reason='+(r.reason||''));

// Seed read_audit for full approve (READ-BEFORE-APPROVE)
seedRead(GATE_A, 'Orchestrator');
seedRead(GATE_B, 'Orchestrator');
const shaA = sha256File(path.resolve(WORK_ONE_ROOT, '.task_temp/'+GATE_A+'/HANDOVER.md'));
const shaB = sha256File(path.resolve(WORK_ONE_ROOT, '.task_temp/'+GATE_B+'/HANDOVER.md'));

// DEBUG: pin down SHA discrepancy
console.log('DEBUG ROOT=' + WORK_ONE_ROOT);
const dbgA = path.resolve(WORK_ONE_ROOT, '.task_temp/' + GATE_A + '/HANDOVER.md');
const dbgB = path.resolve(WORK_ONE_ROOT, '.task_temp/' + GATE_B + '/HANDOVER.md');
console.log('DEBUG A path=' + dbgA + ' sha=' + crypto.createHash('sha256').update(fs.readFileSync(dbgA, 'utf8')).digest('hex') + ' shaA=' + shaA);
console.log('DEBUG B path=' + dbgB + ' sha=' + crypto.createHash('sha256').update(fs.readFileSync(dbgB, 'utf8')).digest('hex') + ' shaB=' + shaB);

// Restore gate A to delivered (correct child A1) so T5 can exercise the approve leg.
// T2's armGate(GATE_A) reset it to 'armed' to test the wrong-child reject path; that
// consumed T1's delivered state, which is fine for the negative test but must be
// re-established before the positive approve leg.
cid = inject('compliance_gate_submit_deliverables', GATE_A, A1, A, 'build', {session_id:GATE_A, step:'resubmitA1'});
r = submitDeliverablesWithCrossCheck(GATE_A, evA as any, {session_id:GATE_A, step:'resubmitA1'} as any);
clearCtx(cid);
record('T1b re-deliver gateA by child A1 (prep for T5)', r.status==='delivered', 'status='+r.status+' reason='+(r.reason||''));

// T5 POS approve gateA by parent A (real SHA + full read)
cid = inject('compliance_gate_approve_deliverables', GATE_A, A, A, 'Orchestrator', {session_id:GATE_A, decision:'approve'});
r = approveDeliverablesWithAudit(GATE_A, 'approve', 'Parent A verified deliverables for gate A parent/child regression.', 'Regression verified: parent/child no-bleed confirmed for gate A.', 'Orchestrator', shaA, undefined, {session_id:GATE_A, decision:'approve'} as any);
clearCtx(cid);
record('T5 POS approve gateA by parent A (real SHA, full read)', r.status==='approved' || r.status==='completed', 'status='+r.status+' approved_by='+((r as ApproveResult).approved_by||'')+' reason='+(r.reason||''));

// T6 POS approve gateB by parent B (real SHA + full read)
cid = inject('compliance_gate_approve_deliverables', GATE_B, B, B, 'Orchestrator', {session_id:GATE_B, decision:'approve'});
r = approveDeliverablesWithAudit(GATE_B, 'approve', 'Parent B verified deliverables for gate B parent/child regression.', 'Regression verified: parent/child no-bleed confirmed for gate B.', 'Orchestrator', shaB, undefined, {session_id:GATE_B, decision:'approve'} as any);
clearCtx(cid);
record('T6 POS approve gateB by parent B (real SHA, full read)', r.status==='approved' || r.status==='completed', 'status='+r.status+' approved_by='+((r as ApproveResult).approved_by||'')+' reason='+(r.reason||''));

// Final DB state: no cross-bleed
const db = getDb();
const fa = db.query('SELECT session_id, status, child_opencode_session_id, parent_opencode_session_id, last_submit_session_id, last_approve_session_id FROM gate_sessions WHERE session_id IN (?,?)').all(GATE_A, GATE_B) as any[];
console.log('FINAL gate_sessions: ' + JSON.stringify(fa, null, 2));
for (const g of fa) {
  const isA = g.session_id === GATE_A;
  const okChild = g.child_opencode_session_id === (isA ? A1 : B1);
  const okParent = g.parent_opencode_session_id === (isA ? A : B);
  const okSubmit = g.last_submit_session_id === (isA ? A1 : B1);
  const okApprove = g.last_approve_session_id === (isA ? A : B);
  record('No-bleed binding '+g.session_id, okChild && okParent, 'child='+g.child_opencode_session_id+' parent='+g.parent_opencode_session_id);
  record('No-bleed last_submit '+g.session_id, okSubmit, 'last_submit='+g.last_submit_session_id);
  record('No-bleed last_approve '+g.session_id, okApprove, 'last_approve='+g.last_approve_session_id+' status='+g.status);
}

const passed = results.filter(x=>x.pass).length;
console.log('');
console.log('==== SUMMARY: '+passed+'/'+results.length+' checks passed ====');
if (passed !== results.length) {
  console.log('FAILURES:');
  results.filter(x=>!x.pass).forEach(x=>console.log('  - '+x.name+': '+x.detail));
}
