import { after } from 'next/server';
import { apiError, apiOk, withErrors } from '@/lib/api';
import { withInvitation } from '@/lib/portal/http';
import { getPortalState } from '@/lib/portal/state';
import { runPostSubmitPipeline } from '@/lib/scoring/pipeline';
import { afterSubmit, submitAssessment } from '@/lib/scoring/submit';

export const maxDuration = 60;

async function handlePOST(_request: Request, { params }: { params: Promise<{ token: string }> }): Promise<Response> {
  const { token } = await params;
  const found = await withInvitation(token);
  if ('response' in found) return found.response;
  const { inv } = found;
  const now = new Date();

  const state = getPortalState(inv, now);
  if (state === 'submitted') return apiError('already_submitted', 'This assessment was already submitted.', 409);
  if (state !== 'in_progress' && state !== 'time_up') return apiError(state, 'This assessment cannot be submitted.', 409);

  // After the deadline plus grace the submission is finished from the saved answers and marked auto-submitted.
  const done = await submitAssessment(inv, now);
  if (!done.ok) {
    if (done.error.code === 'already_submitted') return apiError('already_submitted', 'This assessment was already submitted.', 409);
    return apiError('server_error', 'Something went wrong submitting. Try again.', 500);
  }
  // The submission and the multiple-choice score are saved. Everything else runs after the response and can fail safely.
  after(async () => {
    await afterSubmit(inv, done.data);
    await runPostSubmitPipeline(done.data.submissionId);
  });
  return apiOk({ submittedAt: done.data.submittedAt, autoSubmitted: done.data.autoSubmitted });
}

export const POST = withErrors(handlePOST);
