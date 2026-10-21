import 'server-only';
import { getDb } from '@/lib/db/server';
import { err, ok, type Result } from '@/lib/result';
import type { TaskRow, WorkflowEventRow, WorkflowRunRow } from '@/lib/db/types';

export type OverviewStats = {
  totalCandidates: number;
  inAssessment: number;
  /** submitted invitations / all invitations, or null when there are no invitations yet */
  completionRate: number | null;
  openTasks: number;
};

export async function getOverviewStats(): Promise<Result<OverviewStats>> {
  const db = getDb();
  const [total, inAssessment, invitations, submitted, tasks] = await Promise.all([
    db.from('candidates').select('id', { count: 'exact', head: true }),
    db.from('candidates').select('id', { count: 'exact', head: true }).eq('stage', 'assessment_in_progress'),
    db.from('invitations').select('id', { count: 'exact', head: true }),
    db.from('invitations').select('id', { count: 'exact', head: true }).eq('status', 'submitted'),
    db.from('tasks').select('id', { count: 'exact', head: true }).eq('status', 'open'),
  ]);
  const failed = [total, inAssessment, invitations, submitted, tasks].find((r) => r.error);
  if (failed?.error) return err('db_error', 'Could not load the overview.', failed.error.message);

  const invited = invitations.count ?? 0;
  return ok({
    totalCandidates: total.count ?? 0,
    inAssessment: inAssessment.count ?? 0,
    completionRate: invited === 0 ? null : (submitted.count ?? 0) / invited,
    openTasks: tasks.count ?? 0,
  });
}

const TASK_COLUMNS = 'id, run_id, job_id, candidate_id, type, title, detail, status, due_at, draft, dedupe_key, created_at, updated_at, completed_at';
const RUN_COLUMNS = 'id, instruction, intent, job_id, plan, status, error, is_demo, created_at, updated_at, approved_at, completed_at';
const EVENT_COLUMNS = 'id, run_id, step_id, job_id, candidate_id, type, actor, level, message, data, is_simulated, created_at';

export async function listOpenTasks(limit = 10): Promise<Result<TaskRow[]>> {
  const { data, error } = await getDb().from('tasks').select(TASK_COLUMNS).eq('status', 'open')
    .order('created_at', { ascending: false }).limit(limit);
  if (error) return err('db_error', 'Could not load tasks.', error.message);
  return ok(data as unknown as TaskRow[]);
}

/** Runs that are not finished or cancelled. */
export async function listActiveRuns(limit = 10): Promise<Result<WorkflowRunRow[]>> {
  const { data, error } = await getDb().from('workflow_runs').select(RUN_COLUMNS)
    .not('status', 'in', '(completed,cancelled)').order('created_at', { ascending: false }).limit(limit);
  if (error) return err('db_error', 'Could not load workflows.', error.message);
  return ok(data as unknown as WorkflowRunRow[]);
}

export async function listRecentEvents(limit = 8): Promise<Result<WorkflowEventRow[]>> {
  const { data, error } = await getDb().from('workflow_events').select(EVENT_COLUMNS)
    .order('id', { ascending: false }).limit(limit);
  if (error) return err('db_error', 'Could not load activity.', error.message);
  return ok(data as unknown as WorkflowEventRow[]);
}

export async function listRunsForJob(jobId: string, limit = 10): Promise<Result<WorkflowRunRow[]>> {
  const { data, error } = await getDb().from('workflow_runs').select(RUN_COLUMNS).eq('job_id', jobId)
    .order('created_at', { ascending: false }).limit(limit);
  if (error) return err('db_error', 'Could not load workflows.', error.message);
  return ok(data as unknown as WorkflowRunRow[]);
}
