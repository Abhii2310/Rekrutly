import 'server-only';
import { after } from 'next/server';
import { z } from 'zod';
import { apiError, apiOk, withErrors } from '@/lib/api';
import { submit, writeReview } from '@/lib/ai-task/service';
import { MAX_DELIVERABLE_CHARS } from '@/lib/ai-task/rules';
import { withInvitation } from '@/lib/portal/http';

export const maxDuration = 60;

/** Finishes the task. The candidate is then shown what the planted mistake was; the recruiter's evidence notes are written after. */
async function handlePOST(request: Request, { params }: { params: Promise<{ token: string }> }): Promise<Response> {
  const { token } = await params;
  const found = await withInvitation(token);
  if ('response' in found) return found.response;
  const { inv } = found;
  if (!inv.assessment.ai_task || !inv.submitted_at) return apiError('not_available', 'There is no task to submit.', 409);
  const parsed = z.object({ text: z.string().max(MAX_DELIVERABLE_CHARS * 2) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError('invalid_input', 'Send your answer as text.', 400);
  const res = await submit(inv, parsed.data.text, new Date());
  if (!res.ok) return apiError(res.error.code, res.error.message, res.error.code === 'invalid_input' ? 400 : res.error.code === 'not_started' ? 409 : 500);
  after(() => { void writeReview(res.data.taskId); });
  return apiOk(res.data.state);
}

export const POST = withErrors(handlePOST);
