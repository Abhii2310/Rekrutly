import 'server-only';
import { z } from 'zod';
import { apiError, apiOk, withErrors } from '@/lib/api';
import { getDb } from '@/lib/db/server';
import { env, emailStatus, fromAddress } from '@/lib/env';
import { sendEmail } from '@/lib/executor/email';
import { planDelivery } from '@/lib/executor/email-plan';
import { logEvent } from '@/lib/events';
import { firstNameOf, invitationHtml } from '@/lib/invitations/template';
import { calendarLink, interviewText, whenLabel } from '@/lib/interviews/rules';
import { hashToken } from '@/lib/security/tokens';

export const maxDuration = 30;
const SHAPE = /^[A-Za-z0-9_-]{43}$/;

/** The candidate picks one of the times offered. Only an offered, future time counts, and only the first pick. */
async function handlePOST(request: Request, { params }: { params: Promise<{ token: string }> }): Promise<Response> {
  const { token: raw } = await params;
  const token = raw.trim().replace(/[^A-Za-z0-9_-]+$/, '');
  if (!SHAPE.test(token)) return apiError('invalid_link', "This link isn't valid.", 404);
  const body = z.object({ slot: z.iso.datetime() }).safeParse(await request.json().catch(() => null));
  if (!body.success) return apiError('invalid_input', 'Choose one of the times.', 400);

  const db = getDb();
  const q = await db.from('interviews').select('id, job_id, candidate_id, status, proposed_slots, duration_minutes, candidates(full_name, email), jobs(title)').eq('token_hash', hashToken(token)).maybeSingle();
  if (q.error) return apiError('server_error', 'Something went wrong. Try again in a moment.', 500);
  if (!q.data) return apiError('invalid_link', "This link isn't valid.", 404);
  const iv = q.data as unknown as { id: string; job_id: string; candidate_id: string; status: string; proposed_slots: string[] | null; duration_minutes: number; candidates: { full_name: string; email: string | null } | null; jobs: { title: string } | null };
  if (iv.status !== 'proposed') return apiError('already_chosen', 'A time was already chosen.', 409);
  const chosen = new Date(body.data.slot);
  const offered = (iv.proposed_slots ?? []).some((s) => new Date(s).getTime() === chosen.getTime());
  if (!offered) return apiError('invalid_input', 'That time is not one of the options.', 400);
  if (chosen.getTime() < Date.now()) return apiError('too_late', 'That time has passed. Reply to the email and we will offer new times.', 409);

  const upd = await db.from('interviews').update({ scheduled_at: chosen.toISOString(), status: 'scheduled', proposed_slots: null, updated_at: new Date().toISOString() }).eq('id', iv.id).eq('status', 'proposed').select('id');
  if (upd.error) return apiError('db_error', "Couldn't save your choice. Try again.", 500);
  if (!upd.data || upd.data.length === 0) return apiError('already_chosen', 'A time was already chosen.', 409);

  const name = iv.candidates?.full_name ?? 'The candidate';
  await logEvent({ jobId: iv.job_id, candidateId: iv.candidate_id, type: 'interview.picked', actor: 'candidate', level: 'success', message: `${name} chose ${whenLabel(chosen)} for the interview` });

  // Confirm with the join link and a calendar link, if the sender can reach them.
  const email = iv.candidates?.email;
  if (email) {
    const plan = planDelivery({ status: emailStatus(env), from: fromAddress(env), demoEmail: env.DEMO_CANDIDATE_EMAIL }, [{ id: iv.id, email }]);
    if (plan.mode === 'send') {
      const role = iv.jobs?.title ?? 'the role';
      const joinUrl = `${env.APP_URL}/i/${token}`;
      const text = interviewText({ firstName: firstNameOf(name), role, start: chosen, durationMinutes: iv.duration_minutes, joinUrl, calendarUrl: calendarLink({ title: `Interview: ${role}`, start: chosen, durationMinutes: iv.duration_minutes, details: `Join: ${joinUrl}` }) });
      const sent = await sendEmail({ to: email, subject: `Confirmed: ${text.subject}`, text: text.body, html: invitationHtml(text.body, joinUrl), idempotencyKey: `interview-confirm-${iv.id}` });
      await db.from('interviews').update({ email_status: sent.ok ? 'sent' : 'failed' }).eq('id', iv.id);
    }
  }
  return apiOk({ scheduledAt: chosen.toISOString() });
}

export const POST = withErrors(handlePOST);
