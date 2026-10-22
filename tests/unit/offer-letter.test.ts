import { describe, expect, it } from 'vitest';
import { offerHtml, offerLetter } from '@/lib/offers/template';

const base = { candidateName: 'Devansh Vora', title: 'Product Designer', company: 'Acme', compensation: '₹18,00,000 per year', startDate: '2026-12-01', signerName: 'Abhishek H', signerTitle: 'Hiring Manager', deadlineDays: 7, today: new Date('2026-10-22T06:00:00Z') };

describe('offer letter', () => {
  it('writes the terms the recruiter gave and nothing else', () => {
    const { subject, body } = offerLetter(base);
    expect(subject).toBe('Your offer for the Product Designer role at Acme');
    expect(body).toContain('Dear Devansh Vora,');
    expect(body).toContain('- Compensation: ₹18,00,000 per year');
    expect(body).toContain('- Start date: 1 December 2026');
    expect(body).toContain('by 29 October 2026');
    expect(body).toContain('Hiring Manager, Acme');
  });
  it('says what is not yet agreed instead of inventing it', () => {
    const { body } = offerLetter({ ...base, compensation: '', startDate: null, signerTitle: '' });
    expect(body).toContain('Start date: To be agreed with you');
    expect(body).toContain('To be confirmed in your employment agreement');
    expect(body).toMatch(/\nAcme$/);
  });
  it('makes a list and escapes anything typed in', () => {
    const html = offerHtml(offerLetter({ ...base, candidateName: 'A <b>' }).body);
    expect(html).toContain('<ul');
    expect(html).toContain('A &lt;b&gt;');
    expect(html).not.toContain('<b>');
  });
});
