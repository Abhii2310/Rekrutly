import type { EmailStatus } from '@/lib/env-schema';

export type DeliveryPlan =
  | { mode: 'skip'; message: string; unconfiguredIds: string[] }
  | { mode: 'send'; sendIds: string[]; unconfiguredIds: string[] };

export const MESSAGES = {
  notConfigured: "Links ready. Email isn't configured, so copy links instead.",
  testSenderNoRecipient: "Email uses Resend's test sender, which only delivers to your own address. Set DEMO_CANDIDATE_EMAIL to receive one.",
  testSenderNoMatch: "Email uses Resend's test sender, which only delivers to your own address. None of these candidates use that address, so copy their links instead.",
  nobodyHasEmail: 'No candidate has an email, so copy the links instead.',
} as const;

/**
 * Decides who gets an email. Pure, so every branch can be tested.
 * With Resend's test sender (onboarding@resend.dev) only the account owner's address can receive mail.
 */
export function planDelivery(
  cfg: { status: EmailStatus; from: string; demoEmail?: string },
  invitations: { id: string; email: string | null }[],
): DeliveryPlan {
  const all = invitations.map((i) => i.id);
  if (cfg.status === 'not_configured') return { mode: 'skip', message: MESSAGES.notConfigured, unconfiguredIds: all };
  if (cfg.status === 'test_sender_without_recipient') return { mode: 'skip', message: MESSAGES.testSenderNoRecipient, unconfiguredIds: all };

  const testSender = cfg.from.toLowerCase().includes('resend.dev');
  const demo = cfg.demoEmail?.trim().toLowerCase();
  const canSend = (email: string | null): boolean => Boolean(email) && (!testSender || email?.trim().toLowerCase() === demo);
  const sendIds = invitations.filter((i) => canSend(i.email)).map((i) => i.id);
  const unconfiguredIds = invitations.filter((i) => !canSend(i.email)).map((i) => i.id);

  if (sendIds.length === 0) {
    const anyEmail = invitations.some((i) => i.email);
    return { mode: 'skip', message: testSender && anyEmail ? MESSAGES.testSenderNoMatch : MESSAGES.nobodyHasEmail, unconfiguredIds };
  }
  return { mode: 'send', sendIds, unconfiguredIds };
}
