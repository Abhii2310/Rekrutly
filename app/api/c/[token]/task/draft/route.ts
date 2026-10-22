import 'server-only';
import { z } from 'zod';
import { apiError, apiOk, withErrors } from '@/lib/api';
import { saveDraft } from '@/lib/ai-task/service';
import { MAX_DELIVERABLE_CHARS } from '@/lib/ai-task/rules';
import { withInvitation } from '@/lib/portal/http';

/** Saves the candidate's answer as they write, so a refresh never loses it. */
async function handlePOST(request: Request, { params }: { params: Promise<{ token: string }> }): Promise<Response> {
  const { token } = await params;
  const found = await withInvitation(token);
  if ('response' in found) return found.response;
  const { inv } = found;
  if (!inv.assessment.ai_task || !inv.submitted_at) return apiError('not_available', 'There is no task to do.', 409);
  const parsed = z.object({ text: z.string().max(MAX_DELIVERABLE_CHARS * 2) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError('invalid_input', 'Send the answer as text.', 400);
  await saveDraft(inv, parsed.data.text);
  return apiOk({ saved: true });
}

export const POST = withErrors(handlePOST);
