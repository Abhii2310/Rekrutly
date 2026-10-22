import { describe, expect, it } from 'vitest';
import { invitationHtml, invitationText } from '@/lib/invitations/template';

const link = 'https://rekrutly-seven.vercel.app/a/Yzj_Z8EJB0gO2R15g6WwI87IcKas45wbNzGicaqq_eo';

describe('invitationHtml', () => {
  const { body } = invitationText({ firstName: 'Dev <b>', role: 'Designer', durationMinutes: 30, link, proctored: true });
  const html = invitationHtml(body, link);
  it('has a button and the full link twice, unbroken', () => {
    expect(html).toContain(`href="${link}"`);
    expect(html.split(link).length - 1).toBeGreaterThanOrEqual(3);
    expect(html).toContain('Start your assessment');
  });
  it('escapes anything that came from outside', () => {
    expect(html).not.toContain('<b>');
    expect(html).toContain('Dev &lt;b&gt;');
  });
  it('turns the instruction list into a real list', () => {
    expect(html).toContain('<ul');
    expect(html).toContain('<li');
  });
});

import { submissionText } from '@/lib/invitations/template';

describe('submissionText', () => {
  it('confirms receipt and says what happens next, with no scores', () => {
    const { subject, body } = submissionText({ firstName: 'Devansh', role: 'Product Designer', autoSubmitted: false, proctored: true });
    expect(subject).toBe("We've received your Product Designer assessment");
    expect(body).toContain('Hi Devansh,');
    expect(body).toContain("We'll email you with the next steps");
    expect(body).toContain('seen only by the hiring team');
    expect(body).not.toMatch(/score|result|passed|failed/i);
  });
  it('says so when the time ran out, and leaves out the recording line when not proctored', () => {
    const { body } = submissionText({ firstName: 'D', role: 'R', autoSubmitted: true, proctored: false });
    expect(body).toContain('submitted automatically');
    expect(body).not.toContain('recording');
  });
});
