import 'server-only';
import { apiError, apiOk, withErrors } from '@/lib/api';
import { demoGuard } from '@/lib/demo/guard';
import { getDb } from '@/lib/db/server';
import { emailStatus, env } from '@/lib/env';

export const dynamic = 'force-dynamic';

/** What the Demo Director shows: the latest live assessment with its candidates, plus a health check. */
async function handleGET(): Promise<Response> {
  const denied = await demoGuard();
  if (denied) return denied;
  const db = getDb();
  const [probe, live] = await Promise.all([
    db.from('jobs').select('id').limit(1),
    db.from('assessments').select('id, title, run_id').eq('status', 'live').order('created_at', { ascending: false }).limit(1),
  ]);
  if (live.error) return apiError('db_error', "Couldn't load the demo status.", 500);
  const a = (live.data as { id: string; title: string; run_id: string | null }[])[0] ?? null;
  type Sub = { id: string; scoring_status: string; report_status: string };
  type Row = { id: string; candidate_id: string; status: string; candidates: { full_name: string } | null; submissions: Sub | Sub[] | null };
  let invitations: { id: string; candidateId: string; name: string; status: string; submissionId: string | null; scoring: string | null; report: string | null }[] = [];
  if (a) {
    const inv = await db.from('invitations').select('id, candidate_id, status, candidates(full_name), submissions(id, scoring_status, report_status)').eq('assessment_id', a.id).order('created_at').order('id');
    if (inv.error) return apiError('db_error', "Couldn't load the candidate links.", 500);
    invitations = (inv.data as unknown as Row[]).map((r) => {
      const sub = Array.isArray(r.submissions) ? (r.submissions[0] ?? null) : r.submissions;
      return { id: r.id, candidateId: r.candidate_id, name: r.candidates?.full_name ?? 'Candidate', status: r.status, submissionId: sub?.id ?? null, scoring: sub?.scoring_status ?? null, report: sub?.report_status ?? null };
    })
      .sort((x, y) => x.candidateId.localeCompare(y.candidateId));
  }
  return apiOk({
    health: { db: probe.error ? 'error' : 'ok', ai: { provider: env.AI_PROVIDER, fallback: env.AI_FALLBACK_PROVIDER ?? null }, email: emailStatus(env) },
    assessment: a ? { id: a.id, title: a.title, runId: a.run_id } : null,
    invitations,
  });
}

export const GET = withErrors(handleGET);
