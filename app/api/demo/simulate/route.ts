import { after } from 'next/server';
import { z } from 'zod';
import { apiError, apiOk } from '@/lib/api';
import { demoGuard } from '@/lib/demo/guard';
import { simulateCandidate } from '@/lib/demo/simulate';
import { runPostSubmitPipeline } from '@/lib/scoring/pipeline';

export const maxDuration = 60;

const Body = z.object({ invitationId: z.uuid() });

/** Plays one candidate through the real services. The Demo Director calls this once per candidate, 8 to 12 seconds apart. */
export async function POST(request: Request): Promise<Response> {
  const denied = await demoGuard();
  if (denied) return denied;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError('invalid_input', 'Choose a candidate to simulate.', 400);

  const res = await simulateCandidate(parsed.data.invitationId);
  if (!res.ok) {
    const status = res.error.code === 'not_found' ? 404 : res.error.code === 'not_startable' ? 409 : 500;
    return apiError(res.error.code, res.error.message, status);
  }
  const { submissionId, candidate } = res.data;
  after(async () => { await runPostSubmitPipeline(submissionId); });
  return apiOk({ candidate, submissionId });
}
