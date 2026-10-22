import 'server-only';
import { z } from 'zod';
import { apiError, apiOk, withErrors } from '@/lib/api';
import { env } from '@/lib/env';
import { getDb } from '@/lib/db/server';
import { sendEmail } from '@/lib/executor/email';
import { logEvent } from '@/lib/events';
import { firstNameOf, invitationHtml, invitationText } from '@/lib/invitations/template';
import { requireRecruiter } from '@/lib/security/require-recruiter';
import { decryptToken } from '@/lib/security/tokens';

export const maxDuration = 30;

/** Sends the same personal link again, to the candidate's current email. Used after fixing a bounced address. */
async function handlePOST(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = await requireRecruiter();
  if (denied) return denied;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return apiError('not_found', 'Invitation not found.', 404);

  const db = getDb();
  const q = await db.from('invitations')
    .select('id, status, started_at, token_encrypted, candidate_id, candidates(full_name, email), assessments(title, duration_minutes, proctored, ai_interview, ai_task, job_id, run_id, jobs(title))')
    .eq('id', id).maybeSingle();
  if (q.error) return apiError('db_error', "Couldn't load the invitation.", 500);
  if (!q.data) return apiError('not_found', 'Invitation not found.', 404);
  type Row = {
    id: string; status: string; started_at: string | null; token_encrypted: string; candidate_id: string;
    candidates: { full_name: string; email: string | null } | null;
    assessments: { title: string; duration_minutes: number; proctored: boolean; ai_interview: boolean; ai_task: boolean; job_id: string; run_id: string | null; jobs: { title: string } | null } | null;
  };
  const inv = q.data as unknown as Row;
  if (!inv.candidates?.email) return apiError('no_email', 'This candidate has no email yet.', 409);
  if (inv.started_at || inv.status === 'submitted' || inv.status === 'revoked') return apiError('already_started', 'They already started, so there is nothing to resend.', 409);
  if (!inv.assessments) return apiError('not_found', 'Assessment not found.', 404);

  const link = `${env.APP_URL}/a/${decryptToken(inv.token_encrypted)}`;
  const text = invitationText({
    firstName: firstNameOf(inv.candidates.full_name), role: inv.assessments.jobs?.title ?? 'open', durationMinutes: inv.assessments.duration_minutes,
    link, proctored: inv.assessments.proctored, aiInterview: inv.assessments.ai_interview, aiTask: inv.assessments.ai_task,
  });
  const sent = await sendEmail({ to: inv.candidates.email, subject: text.subject, text: text.body, html: invitationHtml(text.body, link), idempotencyKey: `${id}-${Date.now()}` });
  const base = { runId: inv.assessments.run_id, jobId: inv.assessments.job_id, candidateId: inv.candidate_id };
  if (!sent.ok) {
    await db.from('invitations').update({ delivery_status: 'failed', delivery_error: sent.error.message }).eq('id', id);
    await logEvent({ ...base, type: 'email.failed', actor: 'agent', level: 'error', message: `Couldn't email ${inv.candidates.full_name}: ${sent.error.message}` });
    return apiError('email_failed', sent.error.message, 502);
  }
  await db.from('invitations').update({ delivery_status: 'sent', delivery_error: null, ...(inv.status === 'created' ? { status: 'sent' } : {}) }).eq('id', id);
  await logEvent({ ...base, type: 'email.sent', actor: 'recruiter', level: 'success', message: `Sent the invitation again to ${inv.candidates.full_name}` });
  return apiOk({ sent: true });
}

export const POST = withErrors(handlePOST);
