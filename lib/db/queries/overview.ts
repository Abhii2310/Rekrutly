import 'server-only';
import { getDb } from '@/lib/db/server';
import { err, ok, type Result } from '@/lib/result';

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
