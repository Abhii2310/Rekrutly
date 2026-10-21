import { NextResponse } from 'next/server';
import { env, emailStatus } from '@/lib/env';
import { getDb } from '@/lib/db/server';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const { error } = await getDb().from('jobs').select('id').limit(1);
  if (error) console.error('health: db check failed:', error.message);
  return NextResponse.json({
    data: {
      db: error ? 'error' : 'ok',
      ai: {
        provider: env.AI_PROVIDER,
        fallback: env.AI_FALLBACK_PROVIDER ?? null,
        configured: true, // env validation guarantees keys for every provider in use
      },
      email: emailStatus(env),
      demoMode: env.DEMO_MODE,
      time: new Date().toISOString(),
    },
  });
}
