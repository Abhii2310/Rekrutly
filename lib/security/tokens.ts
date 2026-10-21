import 'server-only';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

export type InvitationToken = { token: string; hash: string; encrypted: string };

/** The key is read lazily so this module can be unit-tested with an explicit key. */
function loadKey(key?: Buffer): Buffer {
  const k = key ?? Buffer.from(process.env.TOKEN_ENC_KEY ?? '', 'base64');
  if (k.length !== 32) throw new Error('TOKEN_ENC_KEY must base64-decode to exactly 32 bytes.');
  return k;
}

const b64 = (b: Buffer): string => b.toString('base64url');

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function encryptToken(token: string, key?: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', loadKey(key), iv);
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return `${b64(iv)}.${b64(cipher.getAuthTag())}.${b64(ciphertext)}`;
}

/** Throws on tampered or malformed input. */
export function decryptToken(encrypted: string, key?: Buffer): string {
  const [iv, tag, ciphertext] = encrypted.split('.');
  if (!iv || !tag || !ciphertext) throw new Error('Malformed encrypted token.');
  const decipher = createDecipheriv('aes-256-gcm', loadKey(key), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64url')), decipher.final()]).toString('utf8');
}

/** 32 random bytes as base64url (43 chars), its sha256 hex for lookup, and an encrypted copy for re-copying the link. */
export function createInvitationToken(key?: Buffer): InvitationToken {
  const token = b64(randomBytes(32));
  return { token, hash: hashToken(token), encrypted: encryptToken(token, key) };
}
