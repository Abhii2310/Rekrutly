import 'server-only';
import { z } from 'zod';
import { apiError, apiOk, withErrors } from '@/lib/api';
import { getDb } from '@/lib/db/server';
import { env, emailStatus, fromAddress } from '@/lib/env';
import { sendEmail } from '@/lib/executor/email';
import { planDelivery } from '@/lib/executor/email-plan';
import { logEvent } from '@/lib/events';
import { offerHtml } from '@/lib/offers/template';
import { requireRecruiter } from '@/lib/security/require-recruiter';
import { decryptToken } from '@/lib/security/tokens';
import { canTransition, type Stage } from '@/lib/status';

export const maxDuration = 30;

/** Emails the approved letter. The recruiter pressed Send after reading it; nothing here is automatic. */
async function handlePOST(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = await requireRecruiter();
  if (denied) return denied;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return apiError('not_found', 'Offer not found.', 404);

  const db = getDb();
  const o = await db.from('offers').select('id, candidate_id, job_id, title, body, status, token_encrypted, candidates(full_name, email, stage)').eq('id', id).maybeSingle();
  if (o.error) return apiError('db_error', "Couldn't load the offer.", 500);
  if (!o.data) return apiError('not_found', 'Offer not found.', 404);
  const offer = o.data as unknown as { id: string; candidate_id: string; job_id: string; title: string; body: string; status: string; token_encrypted: string | null; candidates: { full_name: string; email: string | null; stage: Stage } | null };
  if (offer.status === 'sent') return apiError('already_sent', 'This offer was already sent.', 409);
  const email = offer.candidates?.email;
  if (!email) return apiError('no_email', 'Add the candidate’s email first.', 409);

  const plan = planDelivery({ status: emailStatus(env), from: fromAddress(env), demoEmail: env.DEMO_CANDIDATE_EMAIL }, [{ id: offer.id, email }]);
  if (plan.mode === 'skip') return apiError('email_unavailable', plan.message, 409);

  // Claim it first: a double click or two tabs must not email the offer twice.
  const claim = await db.from('offers').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', id).eq('status', 'draft').select('id');
  if (claim.error) return apiError('db_error', "Couldn't send the offer.", 500);
  if (!claim.data || claim.data.length === 0) return apiError('already_sent', 'This offer was already sent.', 409);
  const subject = `Your offer for the ${offer.title} role`;
  const replyUrl = offer.token_encrypted ? `${env.APP_URL}/o/${decryptToken(offer.token_encrypted)}` : undefined;
  const sent = await sendEmail({ to: email, subject, text: replyUrl ? `${offer.body}\n\nAccept or decline here: ${replyUrl}` : offer.body, html: offerHtml(offer.body, replyUrl), idempotencyKey: `offer-${offer.id}` });
  if (!sent.ok) {
    await db.from('offers').update({ status: 'draft', sent_at: null }).eq('id', id);
    await logEvent({ jobId: offer.job_id, candidateId: offer.candidate_id, type: 'email.failed', actor: 'recruiter', level: 'error', message: `Couldn't email the offer to ${offer.candidates?.full_name ?? 'the candidate'}: ${sent.error.message}` });
    return apiError('email_failed', sent.error.message, 502);
  }
  const stage = offer.candidates?.stage;
  if (stage && canTransition('candidate', stage, 'offer')) await db.from('candidates').update({ stage: 'offer' }).eq('id', offer.candidate_id).eq('stage', stage);
  await logEvent({ jobId: offer.job_id, candidateId: offer.candidate_id, type: 'offer.sent', actor: 'recruiter', level: 'success', message: `Sent the offer letter to ${offer.candidates?.full_name ?? 'the candidate'}` });
  return apiOk({ sent: true });
}

export const POST = withErrors(handlePOST);
