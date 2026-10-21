import 'server-only';
import { z } from 'zod';
import { apiError, apiOk, withErrors } from '@/lib/api';
import { AI_ERROR_STATUS } from '@/lib/ai/attempts';
import { savedQuestions } from '@/lib/ai/fallbacks';
import { generateQuestionSet } from '@/lib/ai/questions';
import { createDraftAssessment, replaceAllQuestions } from '@/lib/db/mutations/assessments';
import { getDb } from '@/lib/db/server';
import { env } from '@/lib/env';
import { completeStep, failStep, startStep } from '@/lib/executor/step-runner';
import { logEvent } from '@/lib/events';
import { requireRecruiter } from '@/lib/security/require-recruiter';

export const maxDuration = 60;

const Body = z.object({ replace: z.boolean().optional(), useSaved: z.boolean().optional() }).optional();
const Params = z.object({
  jobId: z.uuid(), skills: z.array(z.string()).min(1), count: z.number().int().min(3).max(20),
  durationMinutes: z.number().int().min(5).max(180), types: z.array(z.enum(['mcq', 'short'])).min(1),
  difficulty: z.enum(['easy', 'medium', 'hard', 'mixed']),
});
const STALE_MS = 90_000;

async function handlePOST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = await requireRecruiter();
  if (denied) return denied;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return apiError('not_found', 'Workflow not found.', 404);
  const body = Body.safeParse(await request.json().catch(() => undefined));
  const replace = body.success && body.data?.replace === true;
  const useSaved = body.success && body.data?.useSaved === true;
  if (useSaved && !env.DEMO_MODE) return apiError('not_demo', 'Saved questions are only available in demo mode.', 403);

  const db = getDb();
  const [run, step, existing] = await Promise.all([
    db.from('workflow_runs').select('id, intent, status, plan, job_id').eq('id', id).maybeSingle(),
    db.from('workflow_steps').select('id, status, params, started_at').eq('run_id', id).eq('action', 'generate_questions').maybeSingle(),
    db.from('assessments').select('id, status').eq('run_id', id).maybeSingle(),
  ]);
  if (run.error || step.error || existing.error) return apiError('db_error', "Couldn't load the workflow.", 500);
  if (!run.data) return apiError('not_found', 'Workflow not found.', 404);
  if (run.data.intent !== 'create_assessment_workflow' || !step.data) return apiError('invalid_input', "This workflow doesn't write questions.", 400);
  if (!['draft', 'awaiting_approval'].includes(run.data.status as string)) return apiError('invalid_state', "This workflow can't change any more.", 409);

  const assessment = existing.data as { id: string; status: string } | null;
  if (assessment && assessment.status !== 'draft') return apiError('not_draft', "The assessment is already approved, so its questions can't change.", 409);
  if (assessment && !replace) return apiError('already_generated', 'Questions were already written. Use regenerate all to replace them.', 409);

  const parsedParams = Params.safeParse(step.data.params);
  if (!parsedParams.success) return apiError('invalid_input', "The plan's question settings are incomplete.", 400);
  const p = parsedParams.data;
  const ctx = { runId: id, stepId: step.data.id as string, jobId: run.data.job_id as string | null };

  // A step stuck in `executing` for over 90s means an earlier request died; let it be retried.
  const stale = step.data.status === 'executing' && step.data.started_at && Date.now() - new Date(step.data.started_at as string).getTime() > STALE_MS;
  if (stale) await db.from('workflow_steps').update({ status: 'failed', error: 'The earlier attempt did not finish.' }).eq('id', ctx.stepId);

  const started = await startStep(ctx, replace ? ['planned', 'failed', 'completed'] : ['planned', 'failed']);
  if (!started.ok) return apiError(started.error.code, started.error.message, started.error.code === 'step_not_startable' ? 409 : 500);

  const job = await db.from('jobs').select('title, description, skills').eq('id', p.jobId).maybeSingle();
  if (job.error || !job.data) {
    await failStep(ctx, 'The job could not be found.');
    return apiError('not_found', 'The job for this workflow could not be found.', 404);
  }

  const saved0 = useSaved ? savedQuestions() : null;
  if (useSaved && !saved0) {
    await failStep(ctx, 'There is no saved question set yet.');
    return apiError('no_saved_questions', 'There is no saved question set yet. Run npm run capture:fallback after a good run.', 404);
  }
  const meta0 = { provider: env.AI_PROVIDER, model: 'saved', attempts: 0, fellBack: false, durationMs: 0 };
  const gen = saved0 ? { ok: true as const, data: { questions: saved0.questions, warnings: [] as string[], meta: meta0 } } : await generateQuestionSet({
    job: { title: job.data.title as string, description: job.data.description as string, skills: job.data.skills as string[] },
    skills: p.skills, count: p.count, durationMinutes: p.durationMinutes, types: p.types, difficulty: p.difficulty, seed: `${id}:${started.data.attempts}`,
  });
  if (!gen.ok) {
    const friendly =
      gen.error.code === 'timeout' ? "Couldn't generate questions because the AI took too long."
      : gen.error.code === 'invalid_output' ? "Couldn't generate questions because the AI answered in the wrong shape."
      : gen.error.code === 'ai_not_configured' ? gen.error.message
      : "Couldn't generate questions because the AI couldn't be reached.";
    await failStep(ctx, friendly, { ai_error: gen.error.code });
    return apiError(gen.error.code, friendly, AI_ERROR_STATUS[gen.error.code as keyof typeof AI_ERROR_STATUS] ?? 502);
  }
  const { questions, warnings, meta } = gen.data;

  const planTitle = (run.data.plan as { assessment?: { title?: string } } | null)?.assessment?.title;
  const saved = assessment
    ? await replaceAllQuestions(assessment.id, questions)
    : await createDraftAssessment({
        runId: id, jobId: p.jobId, title: planTitle ?? `${job.data.title as string} assessment`, durationMinutes: p.durationMinutes,
        skills: p.skills, isDemo: env.DEMO_MODE, questions,
      });
  if (!saved.ok) {
    await failStep(ctx, "Couldn't save the questions. Retry.");
    return apiError(saved.error.code, "Couldn't save the questions. Retry.", 500);
  }

  const skillCount = new Set(questions.map((q) => q.skill)).size;
  const assessmentId = assessment ? assessment.id : (saved.data as { assessmentId: string }).assessmentId;
  await completeStep(
    ctx, `${useSaved ? 'Loaded' : 'Wrote'} ${questions.length} ${useSaved ? 'saved ' : ''}questions across ${skillCount} ${skillCount === 1 ? 'skill' : 'skills'}`,
    { assessmentId, count: questions.length, warnings, ...(useSaved ? { fallback: true } : {}) },
    'completed', { ai_provider: meta.provider, ai_model: meta.model, ai_fell_back: meta.fellBack, replaced: Boolean(assessment), ...(useSaved ? { fallback: true } : {}) },
  );
  if (useSaved) {
    await logEvent({
      runId: id, stepId: ctx.stepId, jobId: ctx.jobId, type: 'questions.fallback_used', actor: 'recruiter', level: 'warning',
      message: `Used ${questions.length} saved questions instead of the AI`,
    });
  }
  await db.from('workflow_runs').update({ status: 'awaiting_approval' }).eq('id', id).eq('status', 'draft');

  return apiOk({ assessmentId, count: questions.length, warnings });
}

export const POST = withErrors(handlePOST);
