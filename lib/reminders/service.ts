import 'server-only';
import { getDb } from '@/lib/db/server';
import { env, emailStatus, fromAddress } from '@/lib/env';
import { sendEmail } from '@/lib/executor/email';
import { planDelivery } from '@/lib/executor/email-plan';
import { logEvent } from '@/lib/events';
import { examReminderText, firstNameOf, invitationHtml } from '@/lib/invitations/template';
import { interviewReminderText } from '@/lib/interviews/rules';
import { decryptToken } from '@/lib/security/tokens';

export type ReminderResult = { exams: number; interviews: number };

const HOUR = 3_600_000;
const canEmail = (id: string, email: string): boolean =>
  planDelivery({ status: emailStatus(env), from: fromAddress(env), demoEmail: env.DEMO_CANDIDATE_EMAIL }, [{ id, email }]).mode === 'send';

/**
 * Sends the reminders that are due, each at most once: a nudge to someone who has not started their assessment a day after
 * their invitation, and a note about an hour before an interview. Safe to call as often as you like.
 */
export async function runReminders(now: Date = new Date()): Promise<ReminderResult> {
  const db = getDb();
  const out: ReminderResult = { exams: 0, interviews: 0 };

  const inv = await db.from('invitations')
    .select('id, candidate_id, token_encrypted, expires_at, candidates(full_name, email), assessments(duration_minutes, job_id, run_id, status, jobs(title))')
    .eq('delivery_status', 'sent').in('status', ['sent', 'opened']).is('started_at', null).is('reminder_sent_at', null)
    .lt('created_at', new Date(now.getTime() - 24 * HOUR).toISOString()).gt('created_at', new Date(now.getTime() - 6 * 24 * HOUR).toISOString())
    .gt('expires_at', new Date(now.getTime() + 2 * HOUR).toISOString()).limit(15);
  type InvRow = { id: string; candidate_id: string; token_encrypted: string; expires_at: string; candidates: { full_name: string; email: string | null } | null; assessments: { duration_minutes: number; job_id: string; run_id: string | null; status: string; jobs: { title: string } | null } | null };
  for (const r of (inv.data ?? []) as unknown as InvRow[]) {
    const email = r.candidates?.email;
    if (!email || !r.assessments || r.assessments.status === 'closed' || !canEmail(r.id, email)) continue;
    // Claim it first, so two tabs running this at once cannot both send.
    const claim = await db.from('invitations').update({ reminder_sent_at: now.toISOString() }).eq('id', r.id).is('reminder_sent_at', null).select('id');
    if (!claim.data || claim.data.length === 0) continue;
    const link = `${env.APP_URL}/a/${decryptToken(r.token_encrypted)}`;
    const text = examReminderText({ firstName: firstNameOf(r.candidates?.full_name ?? 'there'), role: r.assessments.jobs?.title ?? 'open', durationMinutes: r.assessments.duration_minutes, link, expires: new Date(r.expires_at) });
    const sent = await sendEmail({ to: email, subject: text.subject, text: text.body, html: invitationHtml(text.body, link), idempotencyKey: `reminder-${r.id}` });
    if (!sent.ok) { await db.from('invitations').update({ reminder_sent_at: null }).eq('id', r.id); continue; }
    out.exams++;
    await logEvent({ runId: r.assessments.run_id, jobId: r.assessments.job_id, candidateId: r.candidate_id, type: 'reminder.sent', actor: 'agent', level: 'info', message: `Reminded ${r.candidates?.full_name ?? 'a candidate'} to start their assessment` });
  }

  const iv = await db.from('interviews')
    .select('id, job_id, candidate_id, scheduled_at, token_encrypted, candidates(full_name, email), jobs(title)')
    .eq('status', 'scheduled').is('reminder_sent_at', null)
    .gt('scheduled_at', now.toISOString()).lt('scheduled_at', new Date(now.getTime() + 75 * 60_000).toISOString()).limit(15);
  type IvRow = { id: string; job_id: string; candidate_id: string; scheduled_at: string; token_encrypted: string; candidates: { full_name: string; email: string | null } | null; jobs: { title: string } | null };
  for (const r of (iv.data ?? []) as unknown as IvRow[]) {
    const email = r.candidates?.email;
    if (!email || !canEmail(r.id, email)) continue;
    const claim = await db.from('interviews').update({ reminder_sent_at: now.toISOString() }).eq('id', r.id).is('reminder_sent_at', null).select('id');
    if (!claim.data || claim.data.length === 0) continue;
    const joinUrl = `${env.APP_URL}/i/${decryptToken(r.token_encrypted)}`;
    const text = interviewReminderText({ firstName: firstNameOf(r.candidates?.full_name ?? 'there'), role: r.jobs?.title ?? 'open', start: new Date(r.scheduled_at), joinUrl });
    const sent = await sendEmail({ to: email, subject: text.subject, text: text.body, html: invitationHtml(text.body, joinUrl), idempotencyKey: `interview-reminder-${r.id}` });
    if (!sent.ok) { await db.from('interviews').update({ reminder_sent_at: null }).eq('id', r.id); continue; }
    out.interviews++;
    await logEvent({ jobId: r.job_id, candidateId: r.candidate_id, type: 'reminder.sent', actor: 'agent', level: 'info', message: `Reminded ${r.candidates?.full_name ?? 'a candidate'} about their interview` });
  }
  return out;
}
