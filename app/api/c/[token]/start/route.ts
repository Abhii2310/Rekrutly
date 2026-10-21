import { after } from 'next/server';
import { z } from 'zod';
import { apiError, apiOk } from '@/lib/api';
import { withInvitation } from '@/lib/portal/http';
import { afterStart, startAssessment } from '@/lib/portal/service';
import { getPortalState, toIso } from '@/lib/portal/state';

const Body = z.object({ consent: z.literal(true, { error: 'Please tick the box to confirm you understand.' }) });

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }): Promise<Response> {
  const { token } = await params;
  const found = await withInvitation(token);
  if ('response' in found) return found.response;
  const { inv } = found;
  const now = new Date();

  const state = getPortalState(inv, now);
  if (state === 'in_progress') {
    // Already started: hand back the same deadline. Refreshing never resets the timer.
    return apiOk({ deadlineAt: toIso(inv.deadline_at), serverNow: now.toISOString() });
  }
  if (state !== 'ready') return apiError(state, 'This assessment can no longer be started.', 409);

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError('consent_required', parsed.error.issues[0]?.message ?? 'Please confirm you understand.', 400);

  const started = await startAssessment(inv, now);
  if (!started.ok) return apiError(started.error.code, 'Something went wrong starting the assessment. Try again.', 500);
  after(() => afterStart(inv));
  return apiOk({ deadlineAt: toIso(started.data.deadlineAt), serverNow: now.toISOString() });
}
