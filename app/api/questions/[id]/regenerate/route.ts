import { z } from 'zod';
import { apiError, apiOk } from '@/lib/api';
import { AI_ERROR_STATUS } from '@/lib/ai/attempts';
import { regenerateQuestion } from '@/lib/ai/questions';
import { overwriteQuestion } from '@/lib/db/mutations/assessments';
import { getQuestionContext } from '@/lib/db/queries/assessments';
import { getDb } from '@/lib/db/server';
import { logEvent } from '@/lib/events';
import { requireRecruiter } from '@/lib/security/require-recruiter';

export const maxDuration = 60;

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = await requireRecruiter();
  if (denied) return denied;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return apiError('not_found', 'Question not found.', 404);

  const ctx = await getQuestionContext(id);
  if (!ctx.ok) return apiError(ctx.error.code, ctx.error.message, 500);
  if (!ctx.data) return apiError('not_found', 'Question not found.', 404);
  const { question, assessment } = ctx.data;
  if (assessment.status !== 'draft') return apiError('not_draft', "The assessment is already approved, so its questions can't change.", 409);

  const db = getDb();
  const [job, others] = await Promise.all([
    db.from('jobs').select('title, description, skills').eq('id', assessment.job_id).maybeSingle(),
    db.from('questions').select('prompt').eq('assessment_id', assessment.id),
  ]);
  if (job.error || !job.data || others.error) return apiError('db_error', "Couldn't load what the AI needs.", 500);

  const res = await regenerateQuestion({
    job: { title: job.data.title as string, description: job.data.description as string, skills: job.data.skills as string[] },
    skill: question.skill, type: question.type, difficulty: question.difficulty, durationMinutes: assessment.duration_minutes,
    avoid: (others.data as { prompt: string }[]).map((r) => r.prompt), seed: `${id}:${Date.now()}`,
  });
  if (!res.ok) {
    const message =
      res.error.code === 'timeout' ? "Couldn't regenerate the question because the AI took too long."
      : res.error.code === 'invalid_output' ? "Couldn't regenerate the question because the AI answered in the wrong shape."
      : "Couldn't regenerate the question because the AI couldn't be reached.";
    return apiError(res.error.code, message, AI_ERROR_STATUS[res.error.code as keyof typeof AI_ERROR_STATUS] ?? 502);
  }

  const saved = await overwriteQuestion(id, res.data.question);
  if (!saved.ok) return apiError(saved.error.code, saved.error.message, 500);
  await logEvent({
    runId: assessment.run_id, jobId: assessment.job_id, type: 'question.regenerated', actor: 'agent', level: 'success',
    message: `Regenerated question ${question.position + 1}`,
    data: { questionId: id, ai_provider: res.data.meta.provider, ai_model: res.data.meta.model },
  });
  return apiOk({ id });
}
