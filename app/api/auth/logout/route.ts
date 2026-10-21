import { cookies } from 'next/headers';
import { apiOk } from '@/lib/api';
import { SESSION_COOKIE } from '@/lib/security/session';

export async function POST(): Promise<Response> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 });
  return apiOk({ signedIn: false });
}
