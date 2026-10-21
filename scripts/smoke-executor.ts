// Runs the executor against the dev database: approve twice, assert nothing is duplicated, check receipts,
// then clean up its own rows. Run with `npm run smoke:executor`.
import { executeRun } from '../lib/executor/run';
import { ACTIONS } from '../lib/executor/actions';
import { buildSnapshot } from '../lib/executor/approval';
import { buildSteps } from '../lib/executor/plan-builder';
import { resolvePlan } from '../lib/ai/resolve-plan';
import { getScriptDb } from './db';

const db = getScriptDb();
const JOB = '11111111-1111-4111-8111-000000000001';
let failures = 0;
const check = (name: string, ok: boolean, detail = ''): void => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures++;
};

async function main(): Promise<void> {
  const cands = await db.from('candidates').select('id, full_name, email, stage').eq('job_id', JOB).order('id');
  const rows = cands.data as { id: string; full_name: string; email: string | null; stage: string }[];
  if (rows.length !== 5) throw new Error('Run npm run db:seed first (expected 5 Full-Stack candidates).');

  const { plan } = resolvePlan(
    {
      intent: 'create_assessment_workflow', job_id: JOB, candidate_ids: rows.map((r) => r.id),
      assessment: { title: 'Smoke assessment', duration_minutes: 30, question_count: 3, skills: ['React'], question_types: ['mcq'], difficulty: 'mixed' },
      preview_before_invite: true, clarifications: [], guardrail_flags: [], assumptions: [], summary: 'Smoke test run',
    },
    { selectedJobId: JOB, jobs: [{ id: JOB, title: 'Full-Stack Developer', skills: ['React'] }], candidates: rows.map((r) => ({ id: r.id, job_id: JOB, name: r.full_name, stage: 'applied' as const, has_email: Boolean(r.email), skills: [] })) },
    'smoke test',
  );

  let runId = '';
  let assessmentId = '';
  try {
    const run = await db.from('workflow_runs').insert({ instruction: 'smoke test run', intent: plan.intent, job_id: JOB, plan, status: 'awaiting_approval', is_demo: true }).select('id').single();
    runId = run.data!.id as string;
    const defs = buildSteps(plan);
    const steps = await db.from('workflow_steps').insert(defs.map((s) => ({ run_id: runId, position: s.position, action: s.action, title: s.title, params: s.params, requires_approval: s.requires_approval, status: s.status === 'awaiting_approval' ? 'awaiting_approval' : 'planned' }))).select('id, action, title, requires_approval');
    await db.from('workflow_steps').update({ status: 'completed', result: { message: 'Wrote 3 questions' } }).eq('run_id', runId).eq('action', 'generate_questions');

    const a = await db.from('assessments').insert({ run_id: runId, job_id: JOB, title: 'Smoke assessment', duration_minutes: 30, skills: ['React'], is_demo: true }).select('id').single();
    assessmentId = a.data!.id as string;
    const qs = await db.from('questions').insert([0, 1, 2].map((i) => ({ assessment_id: assessmentId, position: i, type: 'mcq', prompt: `Smoke question number ${i}?`, options: ['a', 'b', 'c', 'd'], skill: 'React', difficulty: 'easy', max_score: 1 }))).select('id');
    await db.from('question_keys').insert((qs.data as { id: string }[]).map((q) => ({ question_id: q.id, correct_option: 0 })));

    // 1a. A run that was never approved cannot even start.
    const never = await executeRun(runId);
    check('refuses to start a run that is still awaiting approval', !never.ok && never.error.code === 'invalid_transition', never.ok ? '' : never.error.message);

    // 1b. Even if a run is marked approved, a step without an approval row for it is refused.
    await db.from('workflow_runs').update({ status: 'approved' }).eq('id', runId);
    await db.from('workflow_steps').update({ status: 'queued' }).eq('run_id', runId).eq('status', 'awaiting_approval');
    const refused = await executeRun(runId);
    check('refuses an approval-requiring step with no approval row', !refused.ok && refused.error.code === 'not_approved', refused.ok ? '' : refused.error.message);
    const afterRefuse = await db.from('workflow_runs').select('status').eq('id', runId).single();
    check('run is marked failed after the refusal', afterRefuse.data?.status === 'failed');
    await db.from('workflow_steps').update({ status: 'awaiting_approval', error: null, attempts: 0 }).eq('run_id', runId).eq('requires_approval', true);
    await db.from('workflow_runs').update({ status: 'awaiting_approval', error: null }).eq('id', runId);

    // 2. Approve (the route does this), then execute.
    const stepRows = steps.data as { id: string; action: string; title: string; requires_approval: boolean }[];
    const snapshot = buildSnapshot({ questionIds: (qs.data as { id: string }[]).map((q) => q.id), durationMinutes: 30, recipients: rows.map((r) => ({ id: r.id, name: r.full_name, hasEmail: Boolean(r.email) })), roleTitle: 'Full-Stack Developer', steps: stepRows });
    await db.from('approvals').insert({ run_id: runId, decision: 'approved', decided_by: 'recruiter', snapshot });
    await db.from('workflow_runs').update({ status: 'approved' }).eq('id', runId);
    await db.from('workflow_steps').update({ status: 'queued' }).eq('run_id', runId).eq('status', 'awaiting_approval');

    const first = await executeRun(runId);
    check('first execution reaches waiting', first.ok && first.data.status === 'waiting', first.ok ? first.data.status : first.error.message);
    const countInv = async () => (await db.from('invitations').select('id', { count: 'exact', head: true }).eq('assessment_id', assessmentId)).count;
    check('5 invitations created', (await countInv()) === 5);

    // 3. "Approve twice": run again, and call the action directly again. Nothing may duplicate.
    const second = await executeRun(runId);
    check('second execution is a no-op that stays waiting', second.ok && second.data.status === 'waiting');
    const ctx = { runId, stepId: stepRows.find((s) => s.action === 'create_invitations')!.id, jobId: JOB };
    const again = await ACTIONS.create_invitations!.execute(ctx, { candidateIds: rows.map((r) => r.id) });
    check('create_invitations twice reports 0 created, 5 skipped', again.ok && (again.data.result as { created: number; skipped: number }).created === 0 && (again.data.result as { skipped: number }).skipped === 5);
    check('still exactly 5 invitations', (await countInv()) === 5);
    const hashes = await db.from('invitations').select('token_hash').eq('assessment_id', assessmentId);
    check('every link has its own token hash', new Set((hashes.data as { token_hash: string }[]).map((h) => h.token_hash)).size === 5);

    // 4. State and receipts.
    const asm = await db.from('assessments').select('status, published_at').eq('id', assessmentId).single();
    check('assessment is live with a publish time', asm.data?.status === 'live' && Boolean(asm.data?.published_at));
    const stage = await db.from('candidates').select('stage').in('id', rows.map((r) => r.id));
    check('all candidates moved to Invited', (stage.data as { stage: string }[]).every((s) => s.stage === 'assessment_invited'));
    const fin = await db.from('workflow_steps').select('action, status, result').eq('run_id', runId).order('position');
    const byAction = Object.fromEntries((fin.data as { action: string; status: string; result: { message?: string } | null }[]).map((s) => [s.action, s]));
    console.log('      steps:', Object.entries(byAction).map(([k, v]) => `${k}=${v.status}`).join(', '));
    check('invitations step finished and email step recorded (sent or skipped)', byAction.create_invitations?.status === 'completed' && ['completed', 'skipped'].includes(byAction.send_invitations?.status ?? ''), byAction.send_invitations?.result?.message ?? '');
    check('track step is waiting', byAction.track_submissions?.status === 'waiting', byAction.track_submissions?.result?.message ?? '');
    const ev = await db.from('workflow_events').select('type, data').eq('run_id', runId);
    const types = (ev.data as { type: string }[]).map((e) => e.type);
    check('5 invitation.created receipts', types.filter((t) => t === 'invitation.created').length === 5);
    check('receipts never contain a token', !JSON.stringify(ev.data).match(/[A-Za-z0-9_-]{43}/));
    check('step.started and step.completed receipts exist', types.includes('step.started') && types.includes('step.completed'));
  } finally {
    if (assessmentId) await db.from('assessments').delete().eq('id', assessmentId);
    if (runId) await db.from('workflow_runs').delete().eq('id', runId);
    await db.from('candidates').update({ stage: 'applied' }).eq('job_id', JOB);
    console.log('cleaned up smoke rows and reset candidate stages');
  }
  if (failures > 0) { console.error(`${failures} check(s) failed`); process.exit(1); }
  console.log('Smoke test passed');
}

main().catch((e) => { console.error('Smoke test error:', e instanceof Error ? e.message : e); process.exit(1); });
