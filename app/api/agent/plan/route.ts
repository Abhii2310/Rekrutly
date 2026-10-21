import { z } from 'zod';
import { apiError, apiOk } from '@/lib/api';
import { AI_ERROR_STATUS } from '@/lib/ai/attempts';
import { savedPlan } from '@/lib/ai/fallbacks';
import { planInstruction } from '@/lib/ai/planner';
import { blockingClarifications, resolvePlan } from '@/lib/ai/resolve-plan';
import { getPlannerContext } from '@/lib/db/queries/planner-context';
import { getDb } from '@/lib/db/server';
import { env } from '@/lib/env';
import { buildSteps } from '@/lib/executor/plan-builder';
import { logEvent } from '@/lib/events';
import { checkInstruction, guardrailMessage, redactFlagged } from '@/lib/guardrails/protected';
import { requireRecruiter } from '@/lib/security/require-recruiter';

export const maxDuration = 60;

const Body = z.object({
  instruction: z.string().trim().min(3, 'Type an instruction first.').max(2000),
  jobId: z.uuid().optional(),
  /** DEMO_MODE only: skip the AI and use the saved demo plan. */
  useSavedPlan: z.boolean().optional(),
});

export async function POST(request: Request): Promise<Response> {
  const denied = await requireRecruiter();
  if (denied) return denied;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError('invalid_input', parsed.error.issues[0]?.message ?? 'Type an instruction first.', 400);
  const { instruction, jobId, useSavedPlan } = parsed.data;
  if (useSavedPlan && !env.DEMO_MODE) return apiError('not_demo', 'Saved plans are only available in demo mode.', 403);

  // 1. Guardrail runs on every instruction, before the model sees it.
  const { flagged } = checkInstruction(instruction);
  const safeInstruction = redactFlagged(instruction, flagged);

  // 2. Planner: the model proposes parameters from the limited context.
  const ctx = await getPlannerContext(jobId ?? null);
  if (!ctx.ok) return apiError(ctx.error.code, ctx.error.message, 500);
  let planned: Awaited<ReturnType<typeof planInstruction>>;
  if (useSavedPlan) {
    const saved = savedPlan();
    if (!saved) return apiError('no_saved_plan', 'There is no saved demo plan yet. Run npm run capture:fallback after a good run.', 404);
    planned = { ok: true, data: { output: saved, meta: { provider: env.AI_PROVIDER, model: 'saved', attempts: 0, fellBack: false, durationMs: 0 } } };
  } else {
    planned = await planInstruction(safeInstruction, ctx.data);
  }
  if (!planned.ok) {
    const code = planned.error.code;
    const status = code === 'ai_not_configured' ? 500 : (AI_ERROR_STATUS[code as keyof typeof AI_ERROR_STATUS] ?? 502);
    const message =
      code === 'timeout' ? 'Couldn\'t create a plan because the AI took too long.'
      : code === 'invalid_output' ? "Couldn't create a plan because the AI answered in the wrong shape."
      : code === 'ai_not_configured' ? planned.error.message
      : "Couldn't create a plan because the AI couldn't be reached.";
    return apiError(code, message, status);
  }

  // 3. Code validates and resolves everything the model said.
  const { plan, clarifications } = resolvePlan(planned.data.output, ctx.data, safeInstruction, flagged);
  if (useSavedPlan) plan.fallback = true;
  const meta = planned.data.meta;
  const aiData = { ai_provider: meta.provider, ai_model: meta.model, ai_fell_back: meta.fellBack };

  if (plan.intent === 'unsupported') return apiOk({ status: 'unsupported' as const, plan });
  const blocking = blockingClarifications(clarifications);
  if (blocking.length > 0) return apiOk({ status: 'needs_clarification' as const, plan, clarifications: blocking });

  // 4. Create the run (draft) and its steps. Approval-requiring steps start as awaiting_approval.
  const db = getDb();
  const run = await db.from('workflow_runs').insert({
    instruction, intent: plan.intent, job_id: plan.job?.id ?? null, plan, status: 'draft', is_demo: env.DEMO_MODE,
  }).select('id').single();
  if (run.error) {
    console.error('plan: could not create run:', run.error.message);
    return apiError('db_error', "Couldn't save the plan.", 500);
  }
  const runId = run.data.id as string;

  const steps = buildSteps(plan);
  const inserted = await db.from('workflow_steps').insert(
    steps.map((s) => ({ run_id: runId, position: s.position, action: s.action, title: s.title, params: s.params, requires_approval: s.requires_approval, status: s.status })),
  );
  if (inserted.error) {
    console.error('plan: could not create steps:', inserted.error.message);
    await db.from('workflow_runs').delete().eq('id', runId);
    return apiError('db_error', "Couldn't save the plan.", 500);
  }

  if (useSavedPlan) {
    await logEvent({
      runId, jobId: plan.job?.id ?? null, type: 'plan.fallback_used', actor: 'recruiter', level: 'warning',
      message: 'Used the saved demo plan instead of the AI', data: { reason: 'recruiter chose the saved plan' },
    });
  }
  await logEvent({
    runId, jobId: plan.job?.id ?? null, type: 'plan.created', actor: 'agent', level: 'success',
    message: `Planned: ${plan.summary || 'a new workflow'}`,
    data: { intent: plan.intent, steps: steps.length, candidates: plan.candidates.length, ...aiData },
  });
  if (plan.guardrail_flags.length > 0) {
    await logEvent({
      runId, jobId: plan.job?.id ?? null, type: 'guardrail.triggered', actor: 'system', level: 'warning',
      message: guardrailMessage(plan.guardrail_flags),
      data: { phrases: plan.guardrail_flags.map((f) => f.phrase) },
    });
  }

  return apiOk({ status: 'ready' as const, runId, plan, steps: steps.map((s) => ({ position: s.position, action: s.action, title: s.title, status: s.status })) });
}
