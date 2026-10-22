import 'server-only';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { apiError, apiOk, withErrors } from '@/lib/api';
import { getDb } from '@/lib/db/server';
import { env, emailStatus, fromAddress } from '@/lib/env';
import { sendEmail } from '@/lib/executor/email';
import { planDelivery } from '@/lib/executor/email-plan';
import { logEvent } from '@/lib/events';
import { firstNameOf, invitationHtml } from '@/lib/invitations/template';
import { calendarLink, interviewText } from '@/lib/interviews/rules';
import { requireRecruiter } from '@/lib/security/require-recruiter';
import { createInvitationToken } from '@/lib/security/tokens';
import { canTransition, type Stage } from '@/lib/status';

export const maxDuration = 30;

const Body = z.object({
  scheduledAt: z.iso.datetime({ error: 'Pick a date and time.' }),
  durationMinutes: z.number().int().min(10).max(180).default(30),
  /** Optional. Your own Google Meet or Zoom link. Without it, a free Jitsi room is made for this interview. */
  meetingUrl: z.url({ protocol: /^https$/, error: 'The meeting link must start with https://' }).max(500).nullable().default(null),
});

/** Books an interview, emails the candidate their join link and calendar link, and moves them to the Interview stage if that is allowed. */
async function handlePOST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = await requireRecruiter();
  if (denied) return denied;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return apiError('not_found', 'Candidate not found.', 404);
  const raw = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const parsed = Body.safeParse({ ...raw, meetingUrl: raw?.meetingUrl || null });
  if (!parsed.success) return apiError('invalid_input', parsed.error.issues[0]?.message ?? 'Check the details.', 400);
  const start = new Date(parsed.data.scheduledAt);
  if (start.getTime() < Date.now() - 5 * 60_000) return apiError('invalid_input', 'That time is in the past.', 400);
  if (start.getTime() > Date.now() + 120 * 86_400_000) return apiError('invalid_input', 'Pick a time within the next 4 months.', 400);

  const db = getDb();
  const c = await db.from('candidates').select('id, job_id, full_name, email, stage, jobs(title)').eq('id', id).maybeSingle();
  if (c.error) return apiError('db_error', "Couldn't load the candidate.", 500);
  if (!c.data) return apiError('not_found', 'Candidate not found.', 404);
  const cand = c.data as unknown as { job_id: string; full_name: string; email: string | null; stage: Stage; jobs: { title: string } | null };
  const role = cand.jobs?.title ?? 'the role';

  const room = `rekrutly-${randomBytes(9).toString('base64url')}`;
  const meetingUrl = parsed.data.meetingUrl ?? `https://meet.jit.si/${room}`;
  const t = createInvitationToken();
  const ins = await db.from('interviews').insert({
    candidate_id: id, job_id: cand.job_id, scheduled_at: start.toISOString(), duration_minutes: parsed.data.durationMinutes, room, meeting_url: meetingUrl,
    token_hash: t.hash, token_encrypted: t.encrypted,
  }).select('id').single();
  if (ins.error) return apiError('db_error', "Couldn't book the interview.", 500);
  const interviewId = ins.data.id as string;

  // Email the candidate, if the configured sender can reach them. The booking stands either way.
  let emailed: 'sent' | 'failed' | 'not_sent' = 'not_sent';
  if (cand.email) {
    const plan = planDelivery({ status: emailStatus(env), from: fromAddress(env), demoEmail: env.DEMO_CANDIDATE_EMAIL }, [{ id: interviewId, email: cand.email }]);
    if (plan.mode === 'send') {
      const joinUrl = `${env.APP_URL}/i/${t.token}`;
      const text = interviewText({
        firstName: firstNameOf(cand.full_name), role, start, durationMinutes: parsed.data.durationMinutes, joinUrl,
        calendarUrl: calendarLink({ title: `Interview: ${role}`, start, durationMinutes: parsed.data.durationMinutes, details: `Join: ${joinUrl}` }),
      });
      const sent = await sendEmail({ to: cand.email, subject: text.subject, text: text.body, html: invitationHtml(text.body, joinUrl), idempotencyKey: `interview-${interviewId}` });
      emailed = sent.ok ? 'sent' : 'failed';
    }
  }
  await db.from('interviews').update({ email_status: emailed }).eq('id', interviewId);
  if (canTransition('candidate', cand.stage, 'interview')) await db.from('candidates').update({ stage: 'interview' }).eq('id', id).eq('stage', cand.stage);
  await logEvent({
    jobId: cand.job_id, candidateId: id, type: 'interview.scheduled', actor: 'recruiter', level: 'success',
    message: `Booked an interview with ${cand.full_name}${emailed === 'sent' ? ' and emailed them' : emailed === 'failed' ? ' (the email failed)' : ' (not emailed)'}`,
  });
  return apiOk({ id: interviewId, emailed });
}

export const POST = withErrors(handlePOST);
