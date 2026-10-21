import 'server-only';
import { after } from 'next/server';
import { z } from 'zod';
import { apiError, apiOk, withErrors } from '@/lib/api';
import { updateAssessment } from '@/lib/db/mutations/assessments';
import { getDb } from '@/lib/db/server';
import { approveSweep } from '@/lib/executor/approve-sweep';
import { buildSnapshot, stepTitles } from '@/lib/executor/approval';
import { executeRun } from '@/lib/executor/run';
import { setRunStatus } from '@/lib/executor/run-status';
import { logEvent } from '@/lib/events';
import { requireRecruiter } from '@/lib/security/require-recruiter';

export const maxDuration = 60;

const Body = z.object({
  durationMinutes: z.number({ error: 'Choose a time limit.' }).int().min(10, 'The time limit is 10 to 120 minutes.').max(120, 'The time limit is 10 to 120 minutes.').refine((n) => n % 5 === 0, 'Use 5-minute steps.'),
  recipientIds: z.array(z.uuid('Some chosen candidates are not valid.'), { error: 'Choose at least one candidate.' }).min(1, 'Choose at least one candidate.').max(50),
});

async function handlePOST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = await requireRecruiter();
  if (denied) return denied;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return apiError('not_found', 'Workflow not found.', 404);
  const db = getDb();
  const run = await db.from('workflow_runs').select('id, intent, status, job_id, plan').eq('id', id).maybeSingle();
  if (run.error) return apiError('db_error', "Couldn't load the workflow.", 500);
  if (!run.data) return apiError('not_found', 'Workflow not found.', 404);
  if (run.data.intent === 'follow_up_sweep') {
    return approveSweep({ id, status: run.data.status as string, job_id: (run.data.job_id as string | null) ?? null, plan: run.data.plan as Record<string, unknown> });
  }

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError('invalid_input', parsed.error.issues[0]?.message ?? 'Check the settings and try again.', 400);
  const { durationMinutes, recipientIds } = parsed.data;

  const runRow = run.data;
  if (run.data.intent !== 'create_assessment_workflow') return apiError('unsupported_intent', "This kind of workflow can't be approved yet.", 400);
  if (!['awaiting_approval', 'draft'].includes(run.data.status as string)) {
    return apiError('already_approved', run.data.status === 'cancelled' ? 'This workflow was cancelled.' : 'This workflow was already approved.', 409);
  }

  const [assessment, steps, cands] = await Promise.all([
    db.from('assessments').select('id, status').eq('run_id', id).maybeSingle(),
    db.from('workflow_steps').select('id, position, action, title, requires_approval, status').eq('run_id', id).order('position'),
    db.from('candidates').select('id, full_name, email, job_id').in('id', recipientIds),
  ]);
  if (assessment.error || steps.error || cands.error) return apiError('db_error', "Couldn't load the workflow.", 500);
  if (!assessment.data) return apiError('no_assessment', 'Write the questions first.', 409);
  if (assessment.data.status !== 'draft') return apiError('not_draft', 'The assessment was already approved.', 409);

  const questions = await db.from('questions').select('id').eq('assessment_id', assessment.data.id).order('position');
  if (questions.error) return apiError('db_error', "Couldn't load the questions.", 500);
  if ((questions.data?.length ?? 0) < 3) return apiError('too_few_questions', 'An assessment needs at least 3 questions before you approve it.', 409);

  const candidates = cands.data as { id: string; full_name: string; email: string | null; job_id: string }[];
  const planIds = new Set(((run.data.plan as { candidates?: { id: string }[] }).candidates ?? []).map((c) => c.id));
  if (candidates.length !== recipientIds.length || candidates.some((c) => c.job_id !== runRow.job_id || !planIds.has(c.id))) {
    return apiError('invalid_input', 'Some chosen candidates are not part of this plan.', 400);
  }

  // Only one request can win the move to `approved`; a double click gets a 409.
  const moved = await setRunStatus(id, 'approved', { approved_at: new Date().toISOString() });
  if (!moved.ok) return apiError(moved.error.code === 'conflict' || moved.error.code === 'invalid_transition' ? 'already_approved' : moved.error.code, 'This workflow was already approved.', 409);

  // Apply the choices: duration on the assessment, recipients in the step params and the plan.
  const withEmail = candidates.filter((c) => c.email);
  const titles = stepTitles(candidates.length, withEmail.length);
  await updateAssessment(assessment.data.id, { duration_minutes: durationMinutes });
  const stepRows = steps.data as { id: string; action: string; title: string; requires_approval: boolean; status: string }[];
  for (const s of stepRows) {
    if (s.action === 'create_invitations') await db.from('workflow_steps').update({ params: { candidateIds: candidates.map((c) => c.id) }, title: titles.create_invitations }).eq('id', s.id);
    if (s.action === 'send_invitations') await db.from('workflow_steps').update({ params: { candidateIds: withEmail.map((c) => c.id) }, title: titles.send_invitations }).eq('id', s.id);
  }
  const plan = run.data.plan as Record<string, unknown>;
  await db.from('workflow_runs').update({
    plan: { ...plan, candidates: candidates.map((c) => ({ id: c.id, name: c.full_name, has_email: Boolean(c.email) })) },
  }).eq('id', id);

  const job = await db.from('jobs').select('title').eq('id', run.data.job_id).maybeSingle();
  const snapshot = buildSnapshot({
    questionIds: (questions.data as { id: string }[]).map((q) => q.id),
    durationMinutes,
    recipients: candidates.map((c) => ({ id: c.id, name: c.full_name, hasEmail: Boolean(c.email) })),
    roleTitle: (job.data?.title as string | undefined) ?? 'open',
    steps: stepRows.map((s) => ({ ...s, title: s.action === 'create_invitations' ? titles.create_invitations : s.action === 'send_invitations' ? titles.send_invitations : s.title })),
  });
  const ins = await db.from('approvals').insert({ run_id: id, decision: 'approved', decided_by: 'recruiter', snapshot });
  if (ins.error) {
    console.error('approve: could not save the approval:', ins.error.message);
    return apiError('db_error', "Couldn't record your approval. Nothing was sent.", 500);
  }
  await db.from('workflow_steps').update({ status: 'queued' }).eq('run_id', id).eq('requires_approval', true).eq('status', 'awaiting_approval');
  await logEvent({
    runId: id, jobId: run.data.job_id as string, type: 'approval.granted', actor: 'recruiter', level: 'success',
    message: `Approved the plan for ${candidates.length} ${candidates.length === 1 ? 'candidate' : 'candidates'}`,
    data: { recipients: candidates.length, durationMinutes },
  });

  // Respond now and run the steps after the response, so the screen can show the Progress Rail filling in live.
  after(async () => {
    const result = await executeRun(id);
    if (!result.ok) console.error('executeRun failed after approval:', result.error.code);
  });
  return apiOk({ runId: id, status: 'approved' });
}

export const POST = withErrors(handlePOST);
