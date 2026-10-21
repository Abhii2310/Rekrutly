import { describe, expect, it } from 'vitest';
import { createInvitationToken, decryptToken, hashToken } from '@/lib/security/tokens';

const key = Buffer.alloc(32, 9);

describe('invitation tokens', () => {
  it('round-trips through encryption', () => {
    const t = createInvitationToken(key);
    expect(decryptToken(t.encrypted, key)).toBe(t.token);
  });

  it('makes a 43-char base64url token, different each call', () => {
    const a = createInvitationToken(key);
    const b = createInvitationToken(key);
    expect(a.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a.token).not.toBe(b.token);
    expect(a.encrypted).not.toBe(b.encrypted);
  });

  it('hash is stable and matches the token', () => {
    const t = createInvitationToken(key);
    expect(hashToken(t.token)).toBe(t.hash);
    expect(hashToken(t.token)).toBe(hashToken(t.token));
    expect(t.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('fails on tampered ciphertext', () => {
    const [iv, tag, ct] = createInvitationToken(key).encrypted.split('.');
    const flipped = `${ct!.slice(0, -2)}${ct!.endsWith('AA') ? 'BB' : 'AA'}`;
    expect(() => decryptToken(`${iv}.${tag}.${flipped}`, key)).toThrow();
  });

  it('fails with the wrong key or malformed input', () => {
    const t = createInvitationToken(key);
    expect(() => decryptToken(t.encrypted, Buffer.alloc(32, 1))).toThrow();
    expect(() => decryptToken('nope', key)).toThrow();
  });

  it('rejects a key that is not 32 bytes', () => {
    expect(() => createInvitationToken(Buffer.alloc(16))).toThrow(/32 bytes/);
  });
});
