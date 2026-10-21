import { z } from 'zod';
import { apiError, apiOk } from '@/lib/api';
import { deleteQuestion, patchQuestion } from '@/lib/db/mutations/assessments';
import { getQuestionContext } from '@/lib/db/queries/assessments';
import { logEvent } from '@/lib/events';
import { requireRecruiter } from '@/lib/security/require-recruiter';
import { QuestionPatch } from '@/lib/validation/questions';

async function load(id: string) {
  if (!z.uuid().safeParse(id).success) return { error: apiError('not_found', 'Question not found.', 404) };
  const ctx = await getQuestionContext(id);
  if (!ctx.ok) return { error: apiError(ctx.error.code, ctx.error.message, 500) };
  if (!ctx.data) return { error: apiError('not_found', 'Question not found.', 404) };
  if (ctx.data.assessment.status !== 'draft') {
    return { error: apiError('not_draft', "The assessment is already approved, so its questions can't change.", 409) };
  }
  return { ctx: ctx.data };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = await requireRecruiter();
  if (denied) return denied;
  const { id } = await params;
  const loaded = await load(id);
  if (loaded.error) return loaded.error;
  const { question, assessment } = loaded.ctx;

  const parsed = QuestionPatch.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError('invalid_input', parsed.error.issues[0]?.message ?? 'Check the question and try again.', 400);
  if (question.type === 'short' && (parsed.data.options || parsed.data.correct_option !== undefined)) {
    return apiError('invalid_input', "Written questions don't have options.", 400);
  }
  if (question.type === 'mcq' && parsed.data.rubric) return apiError('invalid_input', "Multiple-choice questions don't have a rubric.", 400);

  const saved = await patchQuestion(id, question.type, parsed.data);
  if (!saved.ok) return apiError(saved.error.code, saved.error.message, 500);
  await logEvent({
    runId: assessment.run_id, jobId: assessment.job_id, type: 'question.edited', actor: 'recruiter',
    message: `Edited question ${question.position + 1}`, data: { questionId: id, fields: Object.keys(parsed.data) },
  });
  return apiOk({ id });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = await requireRecruiter();
  if (denied) return denied;
  const { id } = await params;
  const loaded = await load(id);
  if (loaded.error) return loaded.error;
  const { question, assessment } = loaded.ctx;

  const del = await deleteQuestion(assessment.id, id);
  if (!del.ok) return apiError(del.error.code, del.error.message, del.error.code === 'too_few_questions' ? 409 : 500);
  await logEvent({
    runId: assessment.run_id, jobId: assessment.job_id, type: 'question.deleted', actor: 'recruiter',
    message: `Deleted question ${question.position + 1}`, data: { questionId: id },
  });
  return apiOk({ id });
}
