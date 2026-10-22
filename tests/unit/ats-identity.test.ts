import { describe, expect, it } from 'vitest';
import { parseIdentity } from '@/lib/ats/identity';

describe('parseIdentity', () => {
  it('reads a name from the top and an email from anywhere', () => {
    expect(parseIdentity('Asha Rao\nSenior Designer\nasha.rao@gmail.com | +91 98765 43210\nExperience...', 'x.pdf')).toEqual({ name: 'Asha Rao', email: 'asha.rao@gmail.com' });
  });
  it('accepts an all-capitals name and skips headings and job titles', () => {
    expect(parseIdentity('RESUME\nRAVI KUMAR\nbackend engineer', 'cv.pdf').name).toBe('Ravi Kumar');
    expect(parseIdentity('Curriculum Vitae\nProduct designer with six years', 'Meera_Joshi_Resume_final.pdf').name).toBe('Meera Joshi');
  });
  it('falls back to the email, then to a plain label', () => {
    expect(parseIdentity('8 years building things. dev.vora04@gmail.com', 'scan1234.pdf')).toEqual({ name: 'Dev Vora', email: 'dev.vora04@gmail.com' });
    expect(parseIdentity('no name here', '2024.pdf')).toEqual({ name: 'New candidate', email: null });
  });
});
