import 'server-only';
import { after } from 'next/server';
import { apiError, apiOk } from '@/lib/api';
import { getDb } from '@/lib/db/server';
import { logEvent } from '@/lib/events';
import { loadPipeline, findTargetRun } from '@/lib/tasks/load';
import { selectTasks } from '@/lib/tasks/rules';
import { env } from '@/lib/env';
import { executeRun } from './run';
import { setRunStatus } from './run-status';

/** Who a sweep would draft messages for right now. Pure read, writes nothing. */
export async function previewSweep(jobId: string | null): Promise<{ targetRunId: string | null; targetTitle: string | null; recipients: { id: string; name: string; hasEmail: boolean }[] }> {
  const target = await findTargetRun(jobId);
  if (!target.ok || !target.data) return { targetRunId: null, targetTitle: null, recipients: [] };
  const pipe = await loadPipeline(target.data.id);
  if (!pipe.ok || !pipe.data) return { targetRunId: target.data.id, targetTitle: target.data.title, recipients: [] };
  const wanted = selectTasks({ now: new Date(), overdueMinutes: env.TASK_OVERDUE_MINUTES, invitations: pipe.data.invitations, interviewCandidates: [] })
    .filter((t) => t.type === 'follow_up');
  const byCandidate = new Map(pipe.data.invitations.map((i) => [i.candidateId, i]));
  return {
    targetRunId: target.data.id,
    targetTitle: target.data.title,
    recipients: wanted.slice(0, 5).map((t) => ({ id: t.candidateId, name: byCandidate.get(t.candidateId)?.name ?? 'Candidate', hasEmail: Boolean(byCandidate.get(t.candidateId)?.email) })),
  };
}

type RunRow = { id: string; status: string; job_id: string | null; plan: Record<string, unknown> };

/** Approval for a follow-up sweep: no assessment, no recipients to choose. Nothing is ever sent. */
export async function approveSweep(run: RunRow): Promise<Response> {
  if (!['awaiting_approval', 'draft'].includes(run.status)) {
    return apiError('already_approved', run.status === 'cancelled' ? 'This workflow was cancelled.' : 'This workflow was already approved.', 409);
  }
  const db = getDb();
  const preview = await previewSweep(run.job_id);
  if (!preview.targetRunId) return apiError('no_target', 'There is no assessment workflow to follow up on yet.', 409);

  const moved = await setRunStatus(run.id, 'approved', { approved_at: new Date().toISOString() });
  if (!moved.ok) return apiError(moved.error.code === 'conflict' || moved.error.code === 'invalid_transition' ? 'already_approved' : moved.error.code, 'This workflow was already approved.', 409);

  const steps = await db.from('workflow_steps').select('id, action, title, requires_approval').eq('run_id', run.id).order('position');
  if (steps.error) return apiError('db_error', "Couldn't load the steps.", 500);
  const rows = steps.data as { id: string; action: string; title: string; requires_approval: boolean }[];
  const params = { targetRunId: preview.targetRunId, jobId: run.job_id };
  await Promise.all(rows.map((s) => db.from('workflow_steps').update({ params }).eq('id', s.id)));
  await db.from('workflow_runs').update({ plan: { ...run.plan, target_run_id: preview.targetRunId } }).eq('id', run.id);

  const ins = await db.from('approvals').insert({
    run_id: run.id, decision: 'approved', decided_by: 'recruiter',
    snapshot: {
      steps: rows.map((s) => ({ id: s.id, action: s.action, title: s.title })),
      approved_step_ids: rows.filter((s) => s.requires_approval).map((s) => s.id),
      recipients: preview.recipients.map((r) => ({ id: r.id, name: r.name, has_email: r.hasEmail })),
      target_run_id: preview.targetRunId,
      nothing_sent: true,
    },
  });
  if (ins.error) {
    console.error('approve sweep: could not save the approval:', ins.error.message);
    return apiError('db_error', "Couldn't record your approval. Nothing was done.", 500);
  }
  await db.from('workflow_steps').update({ status: 'queued' }).eq('run_id', run.id).eq('requires_approval', true).eq('status', 'awaiting_approval');
  await logEvent({
    runId: run.id, jobId: run.job_id, type: 'approval.granted', actor: 'recruiter', level: 'success',
    message: 'Approved reviewing the pipeline and drafting messages. Nothing will be sent.', data: { recipients: preview.recipients.length },
  });
  after(async () => {
    const result = await executeRun(run.id);
    if (!result.ok) console.error('executeRun failed after sweep approval:', result.error.code);
  });
  return apiOk({ runId: run.id, status: 'approved' });
}
