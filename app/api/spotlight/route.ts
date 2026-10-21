import 'server-only';
import { apiError, apiOk, withErrors } from '@/lib/api';
import { getDb } from '@/lib/db/server';
import { requireRecruiter } from '@/lib/security/require-recruiter';

export const dynamic = 'force-dynamic';

/** What Spotlight can jump to: open jobs, candidate names and the latest War Room. Names and IDs only. */
async function handleGET(): Promise<Response> {
  const denied = await requireRecruiter();
  if (denied) return denied;
  const db = getDb();
  const [jobs, candidates, run] = await Promise.all([
    db.from('jobs').select('id, title').eq('status', 'open').order('created_at', { ascending: false }).order('id').limit(30),
    db.from('candidates').select('id, full_name, jobs(title)').order('created_at').order('id').limit(80),
    db.from('workflow_runs').select('id').eq('intent', 'create_assessment_workflow')
      .in('status', ['approved', 'executing', 'waiting', 'paused', 'completed', 'failed']).order('created_at', { ascending: false }).limit(1),
  ]);
  if (jobs.error || candidates.error || run.error) return apiError('db_error', "Couldn't load Spotlight.", 500);
  type C = { id: string; full_name: string; jobs: { title: string } | { title: string }[] | null };
  return apiOk({
    jobs: (jobs.data as { id: string; title: string }[]).map((j) => ({ id: j.id, title: j.title })),
    candidates: (candidates.data as unknown as C[]).map((c) => ({ id: c.id, name: c.full_name, job: (Array.isArray(c.jobs) ? c.jobs[0]?.title : c.jobs?.title) ?? '' })),
    warRoomRunId: (run.data as { id: string }[])[0]?.id ?? null,
  });
}

export const GET = withErrors(handleGET);
