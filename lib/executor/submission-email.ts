import 'server-only';
import { env, emailStatus, fromAddress } from '@/lib/env';
import { getDb } from '@/lib/db/server';
import { logEvent } from '@/lib/events';
import { invitationHtml, submissionText } from '@/lib/invitations/template';
import { sendEmail } from './email';
import { planDelivery } from './email-plan';
import type { ResolvedInvitation } from '@/lib/portal/service';

/**
 * Tells the candidate their answers arrived and what happens next. Runs after the submission is safe, never throws, and
 * never emails a simulated candidate, a demo address, or anyone the configured sender cannot reach.
 */
export async function sendSubmissionEmail(inv: ResolvedInvitation, autoSubmitted: boolean): Promise<void> {
  try {
    if (inv.simulated) return;
    const row = await getDb().from('candidates').select('email').eq('id', inv.candidate_id).maybeSingle();
    const email = (row.data?.email as string | null | undefined) ?? null;
    if (!email) return;
    const plan = planDelivery({ status: emailStatus(env), from: fromAddress(env), demoEmail: env.DEMO_CANDIDATE_EMAIL }, [{ id: inv.id, email }]);
    if (plan.mode === 'skip') return;

    const text = submissionText({ firstName: inv.firstName, role: inv.jobTitle, autoSubmitted, proctored: inv.assessment.proctored });
    const res = await sendEmail({ to: email, subject: text.subject, text: text.body, html: invitationHtml(text.body, undefined), idempotencyKey: `submitted-${inv.id}` });
    const base = { runId: inv.assessment.run_id, jobId: inv.assessment.job_id, candidateId: inv.candidate_id };
    if (res.ok) await logEvent({ ...base, type: 'email.sent', actor: 'system', level: 'success', message: `Sent ${inv.firstName} a confirmation that their submission arrived` });
    else await logEvent({ ...base, type: 'email.failed', actor: 'system', level: 'warning', message: `Couldn't send ${inv.firstName} the submission confirmation: ${res.error.message}` });
  } catch (e) {
    console.error('submission email failed:', e instanceof Error ? e.message : e);
  }
}
