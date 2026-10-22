import 'server-only';
import { z } from 'zod';
import { apiError, apiOk, withErrors } from '@/lib/api';
import { getDb } from '@/lib/db/server';
import { logEvent } from '@/lib/events';
import { SCORECARD_AREAS } from '@/lib/hr/types';
import { requireRecruiter } from '@/lib/security/require-recruiter';

const Body = z.object({
  notes: z.string().max(10_000).optional(),
  status: z.enum(['completed', 'cancelled']).optional(),
  scorecard: z.object({
    ratings: z.record(z.enum(SCORECARD_AREAS), z.number().int().min(1).max(5)),
    summary: z.string().max(2000),
  }).optional(),
});

/** Notes, the scorecard, and completing or cancelling an interview. Ratings are per area; there is no hire/no-hire field. */
async function handlePATCH(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = await requireRecruiter();
  if (denied) return denied;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return apiError('not_found', 'Interview not found.', 404);
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError('invalid_input', 'Check the ratings (1 to 5).', 400);
  const b = parsed.data;

  const db = getDb();
  const cur = await db.from('interviews').select('id, job_id, candidate_id, candidates(full_name)').eq('id', id).maybeSingle();
  if (cur.error) return apiError('db_error', "Couldn't load the interview.", 500);
  if (!cur.data) return apiError('not_found', 'Interview not found.', 404);
  const row = cur.data as unknown as { job_id: string; candidate_id: string; candidates: { full_name: string } | null };

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (b.notes !== undefined) update.notes = b.notes;
  if (b.status) update.status = b.status;
  if (b.scorecard) update.scorecard = { ...b.scorecard, savedAt: new Date().toISOString() };
  const up = await db.from('interviews').update(update).eq('id', id);
  if (up.error) return apiError('db_error', "Couldn't save.", 500);

  const who = row.candidates?.full_name ?? 'the candidate';
  const base = { jobId: row.job_id, candidateId: row.candidate_id, actor: 'recruiter' as const };
  if (b.scorecard) await logEvent({ ...base, type: 'interview.scorecard', level: 'info', message: `Saved the interview scorecard for ${who}` });
  if (b.status === 'completed') await logEvent({ ...base, type: 'interview.completed', level: 'success', message: `Marked the interview with ${who} as done` });
  if (b.status === 'cancelled') await logEvent({ ...base, type: 'interview.cancelled', level: 'warning', message: `Cancelled the interview with ${who}` });
  return apiOk({ saved: true });
}

export const PATCH = withErrors(handlePATCH);
