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
