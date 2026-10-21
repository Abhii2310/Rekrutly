import 'server-only';
import { createHash, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { apiError, apiOk, withErrors } from '@/lib/api';
import { env } from '@/lib/env';
import { SESSION_COOKIE, SESSION_TTL_MS, createSessionValue } from '@/lib/security/session';

const Body = z.object({ passcode: z.string().min(1).max(200) });

const sha = (s: string): Buffer => createHash('sha256').update(s).digest();

async function handlePOST(request: Request): Promise<Response> {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError('invalid_input', 'Enter the passcode.', 400);

  // Hash both sides so the comparison is constant-time even when lengths differ.
  const match = timingSafeEqual(sha(parsed.data.passcode), sha(env.RECRUITER_PASSCODE));
  if (!match) {
    await new Promise((r) => setTimeout(r, 500));
    return apiError('invalid_passcode', "That passcode isn't right.", 401);
  }

  const jar = await cookies();
  jar.set(SESSION_COOKIE, createSessionValue(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
  return apiOk({ signedIn: true });
}

export const POST = withErrors(handlePOST);
