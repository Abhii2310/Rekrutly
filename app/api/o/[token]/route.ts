import 'server-only';
import { z } from 'zod';
import { apiError, apiOk, withErrors } from '@/lib/api';
import { getDb } from '@/lib/db/server';
import { logEvent } from '@/lib/events';
import { hashToken } from '@/lib/security/tokens';
import { canTransition, type Stage } from '@/lib/status';

const SHAPE = /^[A-Za-z0-9_-]{43}$/;

/**
 * The candidate's answer to an offer. It is a POST from a button they press on the page, so an email scanner opening the
 * link cannot accept for them. One answer only. Accepting marks them Hired; declining marks them Withdrawn. The recruiter is told.
 */
async function handlePOST(request: Request, { params }: { params: Promise<{ token: string }> }): Promise<Response> {
  const { token: raw } = await params;
  const token = raw.trim().replace(/[^A-Za-z0-9_-]+$/, '');
  if (!SHAPE.test(token)) return apiError('invalid_link', "This link isn't valid.", 404);
  const body = z.object({ response: z.enum(['accepted', 'declined']) }).safeParse(await request.json().catch(() => null));
  if (!body.success) return apiError('invalid_input', 'Choose accept or decline.', 400);

  const db = getDb();
  const o = await db.from('offers').select('id, candidate_id, job_id, status, response, candidates(full_name, stage)').eq('token_hash', hashToken(token)).maybeSingle();
  if (o.error) return apiError('server_error', 'Something went wrong. Try again in a moment.', 500);
  if (!o.data) return apiError('invalid_link', "This link isn't valid.", 404);
  const offer = o.data as unknown as { id: string; candidate_id: string; job_id: string; status: string; response: string | null; candidates: { full_name: string; stage: Stage } | null };
  if (offer.status !== 'sent') return apiError('not_sent', "This offer isn't available yet.", 409);
  if (offer.response) return apiError('already_answered', 'You have already answered this offer.', 409);

  // Only the first answer counts: the update only matches a row that has no answer yet.
  const upd = await db.from('offers').update({ response: body.data.response, responded_at: new Date().toISOString() }).eq('id', offer.id).is('response', null).select('id');
  if (upd.error) return apiError('db_error', "Couldn't save your answer. Try again.", 500);
  if (!upd.data || upd.data.length === 0) return apiError('already_answered', 'You have already answered this offer.', 409);

  const who = offer.candidates?.full_name ?? 'The candidate';
  const next: Stage = body.data.response === 'accepted' ? 'hired' : 'withdrawn';
  const stage = offer.candidates?.stage;
  if (stage && canTransition('candidate', stage, next)) await db.from('candidates').update({ stage: next }).eq('id', offer.candidate_id).eq('stage', stage);
  await logEvent({
    jobId: offer.job_id, candidateId: offer.candidate_id, type: 'offer.replied', actor: 'candidate', level: body.data.response === 'accepted' ? 'success' : 'warning',
    message: `${who} ${body.data.response} the offer`, data: { response: body.data.response },
  });
  return apiOk({ response: body.data.response });
}

export const POST = withErrors(handlePOST);
