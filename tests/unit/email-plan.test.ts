import { describe, expect, it } from 'vitest';
import { MESSAGES, planDelivery } from '@/lib/executor/email-plan';
import { firstNameOf, invitationText } from '@/lib/invitations/template';

const inv = [
  { id: 'a', email: 'aarav@acme.io' },
  { id: 'b', email: 'diya@acme.io' },
  { id: 'c', email: null },
];

describe('planDelivery', () => {
  it('skips everything when email is not configured', () => {
    const p = planDelivery({ status: 'not_configured', from: 'x' }, inv);
    expect(p).toEqual({ mode: 'skip', message: MESSAGES.notConfigured, unconfiguredIds: ['a', 'b', 'c'] });
  });
  it("skips with the test-sender message when DEMO_CANDIDATE_EMAIL is empty", () => {
    const p = planDelivery({ status: 'test_sender_without_recipient', from: 'Rekrutly <onboarding@resend.dev>' }, inv);
    expect(p.mode).toBe('skip');
    expect(p.mode === 'skip' && p.message).toBe("Email uses Resend's test sender, which only delivers to your own address. Set DEMO_CANDIDATE_EMAIL to receive one.");
  });
  it('sends only to the demo address with the test sender, and marks the rest unconfigured', () => {
    const p = planDelivery({ status: 'configured', from: 'Rekrutly <onboarding@resend.dev>', demoEmail: 'AARAV@acme.io' }, inv);
    expect(p).toEqual({ mode: 'send', sendIds: ['a'], unconfiguredIds: ['b', 'c'] });
  });
  it('explains when nobody matches the test-sender address', () => {
    const p = planDelivery({ status: 'configured', from: 'x@resend.dev', demoEmail: 'me@x.com' }, inv);
    expect(p.mode === 'skip' && p.message).toBe(MESSAGES.testSenderNoMatch);
  });
  it('sends to everyone with an email on a real sender', () => {
    const p = planDelivery({ status: 'configured', from: 'Rekrutly <hi@rekrutly.app>' }, inv);
    expect(p).toEqual({ mode: 'send', sendIds: ['a', 'b'], unconfiguredIds: ['c'] });
  });
  it('never tries reserved example addresses, such as the seeded demo candidates', () => {
    const p = planDelivery({ status: 'configured', from: 'Rekrutly <me@gmail.com>' }, [{ id: 'x', email: 'a@example.com' }, { id: 'y', email: 'b@acme.io' }]);
    expect(p).toEqual({ mode: 'send', sendIds: ['y'], unconfiguredIds: ['x'] });
  });
  it('skips with a clear message when nobody has an email on a real sender', () => {
    const p = planDelivery({ status: 'configured', from: 'hi@rekrutly.app' }, [{ id: 'z', email: null }]);
    expect(p).toEqual({ mode: 'skip', message: MESSAGES.nobodyHasEmail, unconfiguredIds: ['z'] });
  });
});

describe('invitation template', () => {
  it('uses the first name, role, duration and the personal-link warning', () => {
    const { subject, body } = invitationText({ firstName: 'Aarav', role: 'Full-Stack Developer', durationMinutes: 30, link: 'http://x/a/tok' });
    expect(subject).toBe('Your Full-Stack Developer assessment');
    expect(body).toContain('Hi Aarav,');
    expect(body).toContain('about 30 minutes');
    expect(body).toContain('http://x/a/tok');
    expect(body).toContain("Your link is personal. Please don't share it.");
  });
  it('previews without a link, and finds the first name', () => {
    expect(invitationText({ firstName: 'Diya', role: 'R', durationMinutes: 20 }).body).toContain('your personal link');
    expect(firstNameOf('  Diya   Raghunathan ')).toBe('Diya');
  });
});
