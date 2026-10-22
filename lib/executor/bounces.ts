import 'server-only';
import { ImapFlow } from 'imapflow';
import { env } from '@/lib/env';
import { gmailConfigured } from '@/lib/env-schema';
import { getDb } from '@/lib/db/server';
import { logEvent } from '@/lib/events';
import { err, ok, type Result } from '@/lib/result';
import { parseBounce, type Bounce } from './bounce-parse';

/**
 * Reads recent bounce notices from the sending Gmail inbox and marks the matching invitations as failed, so a wrong
 * address shows up in the War Room instead of staying "sent". Only runs when email goes out through Gmail.
 */
export async function checkBounces(): Promise<Result<{ marked: number }>> {
  if (!gmailConfigured(env)) return ok({ marked: 0 });
  const db = getDb();
  const waiting = await db.from('invitations')
    .select('id, assessment_id, candidate_id, candidates(full_name, email), assessments(job_id, run_id)')
    .eq('delivery_status', 'sent').gte('created_at', new Date(Date.now() - 3 * 86_400_000).toISOString());
  if (waiting.error) return err('db_error', "Couldn't read the invitations.", waiting.error.message);
  type Row = { id: string; candidate_id: string; candidates: { full_name: string; email: string | null } | null; assessments: { job_id: string; run_id: string | null } | null };
  const rows = (waiting.data as unknown as Row[]).filter((r) => r.candidates?.email);
  if (rows.length === 0) return ok({ marked: 0 });

  const client = new ImapFlow({ host: 'imap.gmail.com', port: 993, secure: true, auth: { user: env.GMAIL_USER as string, pass: env.GMAIL_APP_PASSWORD as string }, logger: false, socketTimeout: 15_000 });
  const bounces = new Map<string, Bounce>();
  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    try {
      const uids = (await client.search({ since: new Date(Date.now() - 2 * 86_400_000), from: 'mailer-daemon' })) || [];
      // Only the head of each notice is needed: the failed address and the status are near the top.
      for (const uid of uids.slice(-25)) {
        const msg = await client.fetchOne(String(uid), { source: { start: 0, maxLength: 12_000 } });
        if (!msg || !msg.source) continue;
        const b = parseBounce(msg.source.toString('utf8'));
        if (b) bounces.set(b.email, b);
      }
    } finally {
      lock.release();
    }
    await client.logout();
  } catch (e) {
    return err('imap_error', "Couldn't check for bounced emails.", e instanceof Error ? e.message : undefined);
  }

  let marked = 0;
  for (const r of rows) {
    const b = bounces.get((r.candidates?.email ?? '').toLowerCase());
    if (!b) continue;
    const reason = b.notFound ? "This email address doesn't exist." : 'The email bounced.';
    const upd = await db.from('invitations').update({ delivery_status: 'failed', delivery_error: reason }).eq('id', r.id).eq('delivery_status', 'sent').select('id');
    if (!upd.data || upd.data.length === 0) continue;
    marked++;
    await logEvent({
      runId: r.assessments?.run_id ?? null, jobId: r.assessments?.job_id ?? null, candidateId: r.candidate_id, type: 'email.failed', actor: 'system', level: 'error',
      message: `Email to ${r.candidates?.full_name ?? 'a candidate'} bounced: ${reason.toLowerCase()}`,
    });
  }
  return ok({ marked });
}
