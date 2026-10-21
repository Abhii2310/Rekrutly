import { z } from 'zod';
import { apiError, apiOk } from '@/lib/api';
import { addQuestion } from '@/lib/db/mutations/assessments';
import { getAssessmentContext } from '@/lib/db/queries/assessments';
import { logEvent } from '@/lib/events';
import { requireRecruiter } from '@/lib/security/require-recruiter';
import { QuestionInput } from '@/lib/validation/questions';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = await requireRecruiter();
  if (denied) return denied;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return apiError('not_found', 'Assessment not found.', 404);
  const parsed = QuestionInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError('invalid_input', parsed.error.issues[0]?.message ?? 'Check the question and try again.', 400);

  const a = await getAssessmentContext(id);
  if (!a.ok) return apiError(a.error.code, a.error.message, 500);
  if (!a.data) return apiError('not_found', 'Assessment not found.', 404);
  if (a.data.status !== 'draft') return apiError('not_draft', "The assessment is already approved, so its questions can't change.", 409);

  const q = parsed.data;
  const added = await addQuestion(id, q.type === 'mcq'
    ? { ...q, explanation: q.explanation ?? '' }
    : q);
  if (!added.ok) return apiError(added.error.code, added.error.message, 500);
  await logEvent({
    runId: a.data.run_id, jobId: a.data.job_id, type: 'question.added', actor: 'recruiter',
    message: 'Added a question', data: { questionId: added.data },
  });
  return apiOk({ id: added.data }, 201);
}
