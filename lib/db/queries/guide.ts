import 'server-only';
import { getDb } from '@/lib/db/server';
import { err, ok, type Result } from '@/lib/result';

export type GuideProgress = {
  candidates: number;
  assessments: number;
  invitations: number;
  started: number;
  submitted: number;
  /** The newest workflow, so "next step" can open it. */
  latestRunId: string | null;
};

/**
 * What the admin has already done, from real data, so the "Get started" list ticks itself. Only workflows Rekrutly ran
 * count (assessments with a run), so seeded history does not tick steps for someone who has not started.
 */
export async function getGuideProgress(): Promise<Result<GuideProgress>> {
  const db = getDb();
  const [cands, assess, invs, started, subs, run] = await Promise.all([
    db.from('candidates').select('id', { count: 'exact', head: true }),
    db.from('assessments').select('id', { count: 'exact', head: true }).not('run_id', 'is', null),
    db.from('invitations').select('id, assessments!inner(run_id)', { count: 'exact', head: true }).not('assessments.run_id', 'is', null),
    db.from('invitations').select('id, assessments!inner(run_id)', { count: 'exact', head: true }).not('assessments.run_id', 'is', null).not('started_at', 'is', null),
    db.from('submissions').select('id, invitations!inner(assessments!inner(run_id))', { count: 'exact', head: true }).not('invitations.assessments.run_id', 'is', null),
    db.from('workflow_runs').select('id').neq('intent', 'follow_up_sweep').order('created_at', { ascending: false }).limit(1),
  ]);
  const failed = [cands, assess, invs, started, subs, run].find((r) => r.error);
  if (failed?.error) return err('db_error', "Couldn't load your progress.", failed.error.message);
  return ok({
    candidates: cands.count ?? 0, assessments: assess.count ?? 0, invitations: invs.count ?? 0, started: started.count ?? 0, submitted: subs.count ?? 0,
    latestRunId: (run.data?.[0]?.id as string | undefined) ?? null,
  });
}
