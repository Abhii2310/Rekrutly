import 'server-only';
import { getDb } from '@/lib/db/server';
import { err, ok, type Result } from '@/lib/result';
import type { PlannerContext } from '@/lib/ai/resolve-plan';
import type { Stage } from '@/lib/status';

const MAX_CANDIDATES = 50;

/**
 * What the planner may see. Candidates are limited to id, name, stage, a has_email flag and skills:
 * no email address, phone, resume text or anything else about the person.
 */
export async function getPlannerContext(selectedJobId: string | null): Promise<Result<PlannerContext>> {
  const db = getDb();
  const jobs = await db.from('jobs').select('id, title, skills').eq('status', 'open').order('created_at', { ascending: false }).order('id');
  if (jobs.error) return err('db_error', 'Could not load jobs.', jobs.error.message);

  let q = db.from('candidates').select('id, job_id, full_name, stage, skills, email').order('created_at').order('id').limit(MAX_CANDIDATES);
  const selected = jobs.data.find((j) => j.id === selectedJobId);
  if (selected) q = q.eq('job_id', selected.id);
  else q = q.in('job_id', jobs.data.map((j) => j.id));
  const cands = await q;
  if (cands.error) return err('db_error', 'Could not load candidates.', cands.error.message);

  return ok({
    selectedJobId: selected?.id ?? null,
    jobs: jobs.data.map((j) => ({ id: j.id as string, title: j.title as string, skills: j.skills as string[] })),
    candidates: cands.data.map((c) => ({
      id: c.id as string,
      job_id: c.job_id as string,
      name: c.full_name as string,
      stage: c.stage as Stage,
      has_email: Boolean(c.email),
      skills: c.skills as string[],
    })),
  });
}
