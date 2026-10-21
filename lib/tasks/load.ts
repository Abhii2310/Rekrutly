import 'server-only';
import { getDb } from '@/lib/db/server';
import { err, ok, type Result } from '@/lib/result';
import { INVITATION_SELECT, toPipelineInvitation, type PipelineInvitation } from './pipeline';

export type Pipeline = {
  run: { id: string; jobId: string | null; status: string };
  assessment: { id: string; durationMinutes: number } | null;
  invitations: PipelineInvitation[];
  interviewCandidates: { id: string; name: string }[];
};

/** Everything the task rules need for one assessment run. Explicit columns only. */
export async function loadPipeline(runId: string): Promise<Result<Pipeline | null>> {
  const db = getDb();
  const run = await db.from('workflow_runs').select('id, job_id, status').eq('id', runId).maybeSingle();
  if (run.error) return err('db_error', "Couldn't load the workflow.", run.error.message);
  if (!run.data) return ok(null);
  const jobId = (run.data.job_id as string | null) ?? null;

  const [assessment, interview] = await Promise.all([
    db.from('assessments').select('id, duration_minutes').eq('run_id', runId).maybeSingle(),
    jobId ? db.from('candidates').select('id, full_name').eq('job_id', jobId).eq('stage', 'interview') : Promise.resolve({ data: [], error: null }),
  ]);
  if (assessment.error || interview.error) return err('db_error', "Couldn't load the pipeline.", (assessment.error ?? interview.error)?.message);

  let invitations: PipelineInvitation[] = [];
  if (assessment.data) {
    const inv = await db.from('invitations').select(INVITATION_SELECT).eq('assessment_id', assessment.data.id).order('created_at').order('id');
    if (inv.error) return err('db_error', "Couldn't load the candidate links.", inv.error.message);
    invitations = (inv.data as unknown[]).map(toPipelineInvitation).sort((a, b) => a.candidateId.localeCompare(b.candidateId));
  }
  return ok({
    run: { id: runId, jobId, status: run.data.status as string },
    assessment: assessment.data ? { id: assessment.data.id as string, durationMinutes: assessment.data.duration_minutes as number } : null,
    invitations,
    interviewCandidates: ((interview.data ?? []) as { id: string; full_name: string }[]).map((c) => ({ id: c.id, name: c.full_name })),
  });
}

/** The assessment workflow a follow-up sweep looks at: the latest one that has been approved, for the job if one is named. */
export async function findTargetRun(jobId: string | null): Promise<Result<{ id: string; title: string } | null>> {
  let q = getDb().from('workflow_runs').select('id, plan, created_at')
    .eq('intent', 'create_assessment_workflow')
    .in('status', ['approved', 'executing', 'waiting', 'paused', 'completed', 'failed'])
    .order('created_at', { ascending: false }).limit(1);
  if (jobId) q = q.eq('job_id', jobId);
  const { data, error } = await q;
  if (error) return err('db_error', "Couldn't find a workflow to follow up on.", error.message);
  const row = (data as { id: string; plan: { job?: { title?: string } | null } }[])[0];
  return ok(row ? { id: row.id, title: row.plan.job?.title ?? 'Assessment' } : null);
}
