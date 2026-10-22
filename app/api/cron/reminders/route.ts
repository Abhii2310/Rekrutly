import 'server-only';
import { timingSafeEqual } from 'node:crypto';
import { apiError, apiOk, withErrors } from '@/lib/api';
import { env } from '@/lib/env';
import { runReminders } from '@/lib/reminders/service';

export const maxDuration = 60;

function authorised(request: Request): boolean {
  const secret = env.CRON_SECRET;
  if (!secret) return false;
  const given = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? new URL(request.url).searchParams.get('key') ?? '';
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Called by a scheduler (Vercel Cron sends the secret on its own). Off unless CRON_SECRET is set. */
async function handle(request: Request): Promise<Response> {
  if (!authorised(request)) return apiError('forbidden', 'Not allowed.', 403);
  return apiOk(await runReminders());
}

export const GET = withErrors(handle);
export const POST = withErrors(handle);
