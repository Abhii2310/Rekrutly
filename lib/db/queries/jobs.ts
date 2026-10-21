import 'server-only';
import { getDb } from '@/lib/db/server';
import { err, ok, type Result } from '@/lib/result';
import type { JobRow } from '@/lib/db/types';
import type { Stage } from '@/lib/status';

const JOB_COLUMNS = 'id, title, team, location, employment_type, description, skills, status, is_demo, created_at, updated_at';

export type JobWithCounts = JobRow & { candidate_count: number; stage_counts: Partial<Record<Stage, number>> };

export async function listJobs(): Promise<Result<JobWithCounts[]>> {
  const db = getDb();
  const [jobs, cands] = await Promise.all([
    db.from('jobs').select(JOB_COLUMNS).order('created_at', { ascending: false }),
    db.from('candidates').select('job_id, stage'),
  ]);
  if (jobs.error) return err('db_error', 'Could not load jobs.', jobs.error.message);
  if (cands.error) return err('db_error', 'Could not load candidates.', cands.error.message);

  const counts = new Map<string, Partial<Record<Stage, number>>>();
  for (const c of cands.data as { job_id: string; stage: Stage }[]) {
    const m = counts.get(c.job_id) ?? {};
    m[c.stage] = (m[c.stage] ?? 0) + 1;
    counts.set(c.job_id, m);
  }
  const rows = (jobs.data as unknown as JobRow[]).map((j) => {
    const stage_counts = counts.get(j.id) ?? {};
    const candidate_count = Object.values(stage_counts).reduce((a, b) => a + b, 0);
    return { ...j, candidate_count, stage_counts };
  });
  return ok(rows);
}

export async function getJob(id: string): Promise<Result<JobRow | null>> {
  const { data, error } = await getDb().from('jobs').select(JOB_COLUMNS).eq('id', id).maybeSingle();
  if (error) return err('db_error', 'Could not load the job.', error.message);
  return ok((data as unknown as JobRow | null) ?? null);
}
