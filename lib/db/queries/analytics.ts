import 'server-only';
import { getDb } from '@/lib/db/server';
import { computeAnalytics, type Analytics, type AnalyticsInput } from '@/lib/analytics/stats';
import { err, ok, type Result } from '@/lib/result';

export type AnalyticsData = { jobs: { id: string; title: string }[]; selectedJobId: string | null; analytics: Analytics };

/** Six reads in parallel, then one pass in TypeScript. No query per row. */
export async function getAnalytics(jobId: string | null): Promise<Result<AnalyticsData>> {
  const db = getDb();
  const [jobs, cands, assessments, invitations, subs, tasks] = await Promise.all([
    db.from('jobs').select('id, title, is_demo').order('created_at', { ascending: false }).order('id'),
    db.from('candidates').select('job_id, stage, is_demo'),
    db.from('assessments').select('id, job_id'),
    db.from('invitations').select('id, assessment_id, created_at, started_at, submitted_at'),
    db.from('submissions').select('invitation_id, objective_score, objective_max, final_score, final_max, scoring_status, skill_breakdown, is_simulated'),
    db.from('tasks').select('type, job_id').eq('status', 'open'),
  ]);
  const bad = [jobs, cands, assessments, invitations, subs, tasks].find((r) => r.error);
  if (bad?.error) return err('db_error', "Couldn't load the numbers.", bad.error.message);

  const input = {
    jobs: jobs.data, candidates: cands.data, assessments: assessments.data, invitations: invitations.data, submissions: subs.data, tasks: tasks.data,
  } as unknown as AnalyticsInput;
  const known = input.jobs.some((j) => j.id === jobId);
  const selected = known ? jobId : null;
  return ok({ jobs: input.jobs.map((j) => ({ id: j.id, title: j.title })), selectedJobId: selected, analytics: computeAnalytics(input, selected) });
}
