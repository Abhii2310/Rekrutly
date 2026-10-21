import { describe, expect, it } from 'vitest';
import { SESSION_TTL_MS, createSessionValue, verifySessionValue } from '@/lib/security/session';

const key = 'k'.repeat(40);
const now = 1_800_000_000_000;

describe('session cookie', () => {
  it('accepts a freshly created value', () => {
    expect(verifySessionValue(createSessionValue(now, key), now + 1000, key)).toBe(true);
  });

  it('rejects an expired value', () => {
    const v = createSessionValue(now, key);
    expect(verifySessionValue(v, now + SESSION_TTL_MS - 1, key)).toBe(true);
    expect(verifySessionValue(v, now + SESSION_TTL_MS + 1, key)).toBe(false);
  });

  it('rejects a tampered signature or expiry', () => {
    const [exp, sig] = createSessionValue(now, key).split('.') as [string, string];
    const flipped = sig.slice(0, -1) + (sig.endsWith('0') ? '1' : '0');
    expect(verifySessionValue(`${exp}.${flipped}`, now, key)).toBe(false);
    expect(verifySessionValue(`${Number(exp) + 1000000}.${sig}`, now, key)).toBe(false);
  });

  it('rejects a value signed with a different secret', () => {
    expect(verifySessionValue(createSessionValue(now, key), now, 'z'.repeat(40))).toBe(false);
  });

  it('rejects malformed values', () => {
    for (const v of [undefined, null, '', 'abc', 'a.b.c', '123.456', `${now}.${'g'.repeat(64)}`]) {
      expect(verifySessionValue(v, now, key)).toBe(false);
    }
  });

  it('refuses to run with a short secret', () => {
    expect(() => createSessionValue(now, 'short')).toThrow(/32 characters/);
  });
});
