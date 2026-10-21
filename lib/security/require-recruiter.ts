import 'server-only';
import { cookies } from 'next/headers';
import type { NextResponse } from 'next/server';
import { apiError } from '@/lib/api';
import { SESSION_COOKIE, verifySessionValue } from './session';

/** Call at the top of every recruiter route handler: `const denied = await requireRecruiter(); if (denied) return denied;` */
export async function requireRecruiter(): Promise<NextResponse | null> {
  const jar = await cookies();
  if (verifySessionValue(jar.get(SESSION_COOKIE)?.value)) return null;
  return apiError('unauthorized', 'Sign in to continue.', 401);
}
