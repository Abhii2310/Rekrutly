import 'server-only';
import { getDb } from '@/lib/db/server';
import { err, ok, type Result } from '@/lib/result';
import type { ResumeMatch } from '@/lib/ats/rules';

export type HiringFunnel = { steps: { label: string; count: number }[]; total: number };

/**
 * How many people reached each step of the hiring flow, for one role or all of them. Counts of people, never a verdict.
 * A person counts once per step, however many times it happened.
 */
export async function getHiringFunnel(jobId: string | null): Promise<Result<HiringFunnel>> {
  const db = getDb();
  let cq = db.from('candidates').select('id, stage, resume_match, shortlisted');
  if (jobId) cq = cq.eq('job_id', jobId);
  const cands = await cq;
  if (cands.error) return err('db_error', "Couldn't load the funnel.", cands.error.message);
  const rows = cands.data as { id: string; stage: string; resume_match: ResumeMatch | null; shortlisted: boolean }[];
  const ids = rows.map((r) => r.id);
  if (ids.length === 0) return ok({ steps: [], total: 0 });

  const [subs, ivs, offs] = await Promise.all([
    db.from('invitations').select('candidate_id, submissions!inner(id)').in('candidate_id', ids),
    db.from('interviews').select('candidate_id').in('candidate_id', ids).in('status', ['scheduled', 'completed']),
    db.from('offers').select('candidate_id').in('candidate_id', ids).eq('status', 'sent'),
  ]);
  const failed = [subs, ivs, offs].find((r) => r.error);
  if (failed?.error) return err('db_error', "Couldn't load the funnel.", failed.error.message);
  const set = (data: unknown): Set<string> => new Set((data as { candidate_id: string }[]).map((r) => r.candidate_id));
  const assessed = set(subs.data);
  const interviewed = set(ivs.data);
  const offered = set(offs.data);

  return ok({
    total: rows.length,
    steps: [
      { label: 'Applied', count: rows.length },
      { label: 'Resume checked', count: rows.filter((r) => r.resume_match).length },
      { label: 'Shortlisted', count: rows.filter((r) => r.shortlisted).length },
      { label: 'Took the assessment', count: assessed.size },
      { label: 'Interviewed', count: interviewed.size },
      { label: 'Offer sent', count: offered.size },
      { label: 'Hired', count: rows.filter((r) => r.stage === 'hired').length },
    ],
  });
}
