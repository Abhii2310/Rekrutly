import { apiError, apiOk } from '@/lib/api';
import { demoGuard } from '@/lib/demo/guard';
import { seedDemo } from '@/lib/demo/seed';
import { getDb } from '@/lib/db/server';
import { env } from '@/lib/env';
import { logEvent } from '@/lib/events';

export const maxDuration = 60;

/** Same logic as `npm run db:seed`. Deletes every demo run, assessment, invitation and submission, then reseeds with fixed IDs. */
export async function POST(): Promise<Response> {
  const denied = await demoGuard();
  if (denied) return denied;
  try {
    const result = await seedDemo(getDb(), { candidateEmail: env.DEMO_CANDIDATE_EMAIL ?? null, candidateWhatsapp: env.DEMO_CANDIDATE_WHATSAPP ?? null });
    await logEvent({ type: 'demo.reset', actor: 'recruiter', level: 'warning', message: `Reset the demo data: ${result.jobs} jobs and ${result.candidates} candidates`, data: { jobs: result.jobs, candidates: result.candidates } });
    return apiOk({ jobs: result.jobs, candidates: result.candidates, summary: result.summary });
  } catch (e) {
    console.error('demo reset failed:', e instanceof Error ? e.message : e);
    return apiError('reset_failed', "Couldn't reset the demo data. Try again.", 500);
  }
}
