import { cookies } from 'next/headers';
import { apiOk, withErrors } from '@/lib/api';
import { SESSION_COOKIE } from '@/lib/security/session';

async function handlePOST(): Promise<Response> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 });
  return apiOk({ signedIn: false });
}

export const POST = withErrors(handlePOST);
