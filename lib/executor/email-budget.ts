import 'server-only';
import { getDb } from '@/lib/db/server';
import { err, ok, type Result } from '@/lib/result';

import { overBudget } from './email-limits';

// Every kind of email Rekrutly sends leaves one of these receipts, so counting them counts the emails.
const EMAIL_EVENTS = ['email.sent', 'reminder.sent', 'interview.scheduled', 'interview.proposed', 'interview.picked', 'offer.sent'];

/**
 * A ceiling on how many emails go out from the one sender account. The app is open to anyone with the link, so this keeps
 * a stranger from using it to spam people from your Gmail. It is far above what a real demo needs.
 */
export async function checkEmailBudget(now: Date = new Date()): Promise<Result<true>> {
  const db = getDb();
  const [hour, day] = await Promise.all([
    db.from('workflow_events').select('id', { count: 'exact', head: true }).in('type', EMAIL_EVENTS).gte('created_at', new Date(now.getTime() - 3_600_000).toISOString()),
    db.from('workflow_events').select('id', { count: 'exact', head: true }).in('type', EMAIL_EVENTS).gte('created_at', new Date(now.getTime() - 86_400_000).toISOString()),
  ]);
  // If the receipts cannot be read, do not block real mail: fail open.
  if (hour.error || day.error) return ok(true);
  if (overBudget(hour.count ?? 0, day.count ?? 0)) return err('email_limit', 'Email sending is paused to protect the sender account (too many emails in a short time). Try again later.');
  return ok(true);
}
