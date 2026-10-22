import { describe, expect, it } from 'vitest';
import { rejectionText } from '@/lib/rejections/template';

describe('rejectionText', () => {
  it('is kind, names the role, and gives no reasons or scores', () => {
    const { subject, body } = rejectionText({ firstName: 'Devansh', role: 'Product Designer' });
    expect(subject).toBe('Your application for the Product Designer role');
    expect(body).toContain('Hi Devansh,');
    expect(body).toContain('Thank you for your interest');
    expect(body).not.toMatch(/score|assessment result|failed|lacked|not good enough/i);
    expect(body.endsWith('The hiring team')).toBe(true);
  });
  it('uses the signer when given', () => {
    expect(rejectionText({ firstName: 'D', role: 'R', signer: 'Abhishek' }).body.endsWith('Abhishek')).toBe(true);
  });
});
