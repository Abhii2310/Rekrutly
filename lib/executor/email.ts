import 'server-only';
import { env } from '@/lib/env';
import { err, ok, type Result } from '@/lib/result';

/** Sends one email through Resend. "Sent" means the provider said yes; anything else is an error. */
export async function sendEmail(input: { to: string; subject: string; text: string; idempotencyKey: string }): Promise<Result<{ id: string }>> {
  if (!env.RESEND_API_KEY) return err('email_not_configured', 'Email is not configured.');
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': input.idempotencyKey,
      },
      body: JSON.stringify({ from: env.EMAIL_FROM, to: [input.to], subject: input.subject, text: input.text }),
      signal: AbortSignal.timeout(15_000),
    });
    const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok || !body.id) return err('email_failed', (body.message ?? `The email provider answered ${res.status}.`).slice(0, 200));
    return ok({ id: body.id });
  } catch (e) {
    return err('email_failed', e instanceof Error && e.name === 'TimeoutError' ? 'The email provider took too long.' : "Couldn't reach the email provider.");
  }
}
