import { createHmac, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE = 'rk_session';
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function secret(override?: string): string {
  const s = override ?? process.env.SESSION_SECRET ?? '';
  if (s.length < 32) throw new Error('SESSION_SECRET must be at least 32 characters.');
  return s;
}

function sign(expiresAtMs: string, key: string): string {
  return createHmac('sha256', key).update(expiresAtMs).digest('hex');
}

/** `<expiresAtMs>.<hmacSHA256(expiresAtMs, SESSION_SECRET)>`, valid for 7 days. */
export function createSessionValue(now: number = Date.now(), key?: string): string {
  const expires = String(now + SESSION_TTL_MS);
  return `${expires}.${sign(expires, secret(key))}`;
}

export function verifySessionValue(value: string | undefined | null, now: number = Date.now(), key?: string): boolean {
  if (!value) return false;
  const parts = value.split('.');
  if (parts.length !== 2) return false;
  const [expires, sig] = parts as [string, string];
  if (!/^\d{10,16}$/.test(expires) || !/^[0-9a-f]{64}$/.test(sig)) return false;
  const expected = Buffer.from(sign(expires, secret(key)), 'hex');
  const given = Buffer.from(sig, 'hex');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return false;
  return Number(expires) > now;
}
