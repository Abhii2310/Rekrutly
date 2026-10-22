import 'server-only';
import { z } from 'zod';
import { apiError, apiOk, withErrors } from '@/lib/api';
import { getDb } from '@/lib/db/server';
import { env, emailStatus, fromAddress } from '@/lib/env';
import { sendEmail } from '@/lib/executor/email';
import { planDelivery } from '@/lib/executor/email-plan';
import { logEvent } from '@/lib/events';
import { requireRecruiter } from '@/lib/security/require-recruiter';
import { canTransition, type Stage } from '@/lib/status';

export const maxDuration = 30;

const Body = z.object({
  sendEmail: z.boolean(),
  subject: z.string().trim().max(200).optional(),
  body: z.string().trim().max(4000).optional(),
});

/** Moves a candidate to Rejected. With `sendEmail`, the letter the recruiter approved goes out first; a failed email stops the rejection. */
async function handlePOST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = await requireRecruiter();
  if (denied) return denied;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return apiError('not_found', 'Candidate not found.', 404);
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError('invalid_input', 'Check the message.', 400);
  const b = parsed.data;

  const db = getDb();
  const c = await db.from('candidates').select('id, job_id, full_name, email, stage').eq('id', id).maybeSingle();
  if (c.error) return apiError('db_error', "Couldn't load the candidate.", 500);
  if (!c.data) return apiError('not_found', 'Candidate not found.', 404);
  const cand = c.data as { job_id: string; full_name: string; email: string | null; stage: Stage };
  if (!canTransition('candidate', cand.stage, 'rejected')) return apiError('invalid_transition', `A candidate in this stage can't be rejected.`, 409);

  const base = { jobId: cand.job_id, candidateId: id, actor: 'recruiter' as const };
  if (b.sendEmail) {
    if (!cand.email) return apiError('no_email', 'Add their email first, or reject without an email.', 409);
    if (!b.body || b.body.length < 20) return apiError('invalid_input', 'The message looks too short.', 400);
    const plan = planDelivery({ status: emailStatus(env), from: fromAddress(env), demoEmail: env.DEMO_CANDIDATE_EMAIL }, [{ id, email: cand.email }]);
    if (plan.mode === 'skip') return apiError('email_unavailable', plan.message, 409);
    // Claim it first, so two clicks cannot send two emails.
    const claim = await db.from('candidates').update({ rejection_emailed_at: new Date().toISOString() }).eq('id', id).is('rejection_emailed_at', null).select('id');
    if (claim.error) return apiError('db_error', "Couldn't send the email.", 500);
    if (!claim.data || claim.data.length === 0) return apiError('already_sent', 'A rejection email was already sent to this person.', 409);
    const sent = await sendEmail({ to: cand.email, subject: b.subject || 'Your application', text: b.body, idempotencyKey: `reject-${id}` });
    if (!sent.ok) {
      await db.from('candidates').update({ rejection_emailed_at: null }).eq('id', id);
      await logEvent({ ...base, type: 'email.failed', level: 'error', message: `Couldn't email ${cand.full_name}: ${sent.error.message}` });
      return apiError('email_failed', `The email didn't send, so nobody was rejected. ${sent.error.message}`, 502);
    }
    await logEvent({ ...base, type: 'email.sent', level: 'success', message: `Sent ${cand.full_name} a rejection email` });
  }
  await db.from('candidates').update({ stage: 'rejected' }).eq('id', id).eq('stage', cand.stage);
  await logEvent({ ...base, type: 'candidate.stage_changed', level: 'info', message: `Rejected ${cand.full_name}${b.sendEmail ? ' and emailed them' : ' without an email'}`, data: { from: cand.stage, to: 'rejected' } });
  return apiOk({ rejected: true });
}

export const POST = withErrors(handlePOST);
