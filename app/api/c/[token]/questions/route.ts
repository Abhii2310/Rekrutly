import { apiError, apiOk, withErrors } from '@/lib/api';
import { getQuestionsForCandidate } from '@/lib/db/queries/candidate-questions';
import { withInvitation } from '@/lib/portal/http';
import { listSavedAnswers } from '@/lib/portal/service';
import { getPortalState, toIso } from '@/lib/portal/state';

export const dynamic = 'force-dynamic';

/** Only after the test has started. Questions come from the candidate-safe query: no keys, no rubrics. */
async function handleGET(_request: Request, { params }: { params: Promise<{ token: string }> }): Promise<Response> {
  const { token } = await params;
  const found = await withInvitation(token);
  if ('response' in found) return found.response;
  const { inv } = found;
  const now = new Date();
  const state = getPortalState(inv, now);
  if (state !== 'in_progress') return apiError(state, 'The questions are not available right now.', 409);

  const [questions, saved] = await Promise.all([getQuestionsForCandidate(inv.assessment_id), listSavedAnswers(inv.id)]);
  if (!questions.ok || !saved.ok) return apiError('server_error', 'Something went wrong loading the questions. Try again.', 500);
  return apiOk({
    questions: questions.data,
    answers: saved.data,
    deadlineAt: toIso(inv.deadline_at),
    serverNow: now.toISOString(),
    currentQuestion: inv.current_question,
  });
}

export const GET = withErrors(handleGET);
