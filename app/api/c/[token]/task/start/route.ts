import 'server-only';
import { apiError, apiOk, withErrors } from '@/lib/api';
import { start } from '@/lib/ai-task/service';
import { withInvitation } from '@/lib/portal/http';

export const maxDuration = 60;

/** Prepares this task (a work scenario with a hidden planted mistake) and returns it. Safe to repeat. */
async function handlePOST(_request: Request, { params }: { params: Promise<{ token: string }> }): Promise<Response> {
  const { token } = await params;
  const found = await withInvitation(token);
  if ('response' in found) return found.response;
  const { inv } = found;
  if (!inv.assessment.ai_task) return apiError('not_enabled', 'This assessment has no AI task.', 409);
  if (!inv.submitted_at) return apiError('submit_first', 'Submit the assessment first.', 409);
  const res = await start(inv, new Date());
  if (!res.ok) return apiError(res.error.code, res.error.message, 500);
  return apiOk(res.data);
}

export const POST = withErrors(handlePOST);
