import { z } from 'zod';
import { apiError, apiOk, withErrors } from '@/lib/api';
import { withInvitation } from '@/lib/portal/http';
import { recordSignals } from '@/lib/portal/service';
import { canWriteAnswers } from '@/lib/portal/state';

const Body = z.object({ events: z.array(z.object({ type: z.string().max(40), at: z.string().max(40).optional() })).max(20) });

/** Integrity signals are hints for a human, never proof, and never block the candidate. */
async function handlePOST(request: Request, { params }: { params: Promise<{ token: string }> }): Promise<Response> {
  const { token } = await params;
  const found = await withInvitation(token);
  if ('response' in found) return found.response;
  const { inv } = found;
  const now = new Date();

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError('invalid_input', 'Too many events in one request.', 400);
  if (canWriteAnswers(inv, now)) await recordSignals(inv, parsed.data.events, now);
  return apiOk({ received: parsed.data.events.length });
}

export const POST = withErrors(handlePOST);
