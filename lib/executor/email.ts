import 'server-only';
import nodemailer from 'nodemailer';
import { env, fromAddress } from '@/lib/env';
import { gmailConfigured } from '@/lib/env-schema';
import { err, ok, type Result } from '@/lib/result';

/** Sends one email through Resend. "Sent" means the provider said yes; anything else is an error. */
export async function sendEmail(input: { to: string; subject: string; text: string; html?: string; idempotencyKey: string }): Promise<Result<{ id: string }>> {
  if (gmailConfigured(env)) return sendWithGmail(input);
  if (!env.RESEND_API_KEY) return err('email_not_configured', 'Email is not configured.');
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': input.idempotencyKey,
      },
      body: JSON.stringify({ from: env.EMAIL_FROM, to: [input.to], subject: input.subject, text: input.text, ...(input.html ? { html: input.html } : {}) }),
      signal: AbortSignal.timeout(15_000),
    });
    const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok || !body.id) return err('email_failed', (body.message ?? `The email provider answered ${res.status}.`).slice(0, 200));
    return ok({ id: body.id });
  } catch (e) {
    return err('email_failed', e instanceof Error && e.name === 'TimeoutError' ? 'The email provider took too long.' : "Couldn't reach the email provider.");
  }
}

/** Sends from the recruiter's own Gmail account to any address, using a Google app password. */
async function sendWithGmail(input: { to: string; subject: string; text: string; html?: string }): Promise<Result<{ id: string }>> {
  try {
    const transport = nodemailer.createTransport({
      host: 'smtp.gmail.com', port: 465, secure: true,
      auth: { user: env.GMAIL_USER, pass: env.GMAIL_APP_PASSWORD },
      connectionTimeout: 10_000, socketTimeout: 15_000,
    });
    const info = await transport.sendMail({ from: fromAddress(env), to: input.to, subject: input.subject, text: input.text, ...(input.html ? { html: input.html } : {}) });
    return ok({ id: info.messageId });
  } catch (e) {
    const code = (e as { responseCode?: number }).responseCode;
    return err('email_failed', code === 535 ? 'Gmail refused the sign-in. Check the app password.' : "Couldn't send through Gmail.");
  }
}
