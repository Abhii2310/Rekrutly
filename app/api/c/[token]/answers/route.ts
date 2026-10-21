import { z } from 'zod';
import { apiError, apiOk, withErrors } from '@/lib/api';
import { withInvitation } from '@/lib/portal/http';
import { getQuestionForAnswer, saveAnswer } from '@/lib/portal/service';
import { canWriteAnswers, validateAnswer } from '@/lib/portal/state';

const Body = z.object({
  questionId: z.uuid(),
  selectedOption: z.number().int().nullable().optional(),
  textAnswer: z.string().nullable().optional(),
  currentQuestion: z.number().int().min(1).max(100),
});

async function handlePUT(request: Request, { params }: { params: Promise<{ token: string }> }): Promise<Response> {
  const { token } = await params;
  const found = await withInvitation(token);
  if ('response' in found) return found.response;
  const { inv } = found;
  const now = new Date();

  // The server's clock decides, not the browser's timer: deadline plus a 30 second grace period.
  if (!canWriteAnswers(inv, now)) return apiError('closed', 'Time is up, or this assessment was already submitted.', 409);

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError('invalid_input', 'That answer could not be saved.', 400);
  const { questionId, selectedOption, textAnswer, currentQuestion } = parsed.data;

  const q = await getQuestionForAnswer(inv.assessment_id, questionId);
  if (!q.ok) return apiError('server_error', 'Something went wrong saving your answer.', 500);
  if (!q.data) return apiError('invalid_input', 'That question is not part of this assessment.', 400);

  const clean = validateAnswer(q.data, { selectedOption, textAnswer });
  if (!clean.ok) return apiError(clean.error.code, clean.error.message, 400);

  const saved = await saveAnswer(inv, questionId, clean.data, currentQuestion);
  if (!saved.ok) return apiError('server_error', 'Something went wrong saving your answer.', 500);
  return apiOk({ savedAt: saved.data.savedAt });
}

export const PUT = withErrors(handlePUT);
