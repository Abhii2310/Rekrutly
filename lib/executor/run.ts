import 'server-only';
import { getDb } from '@/lib/db/server';
import { logEvent } from '@/lib/events';
import { err, ok, type Result } from '@/lib/result';
import type { RunStatus, StepStatus } from '@/lib/status';
import { ACTIONS } from './actions';
import { setRunStatus } from './run-status';
import { completeStep, failStep, skipStep, startStep } from './step-runner';

type StepRow = { id: string; position: number; action: string; title: string; params: unknown; requires_approval: boolean; status: StepStatus };

/** True when an approval row exists and its snapshot lists this step. A step added later needs a new approval. */
async function isApproved(runId: string, stepId: string): Promise<boolean> {
  const a = await getDb().from('approvals').select('snapshot').eq('run_id', runId).eq('decision', 'approved');
  if (a.error) return false;
  return (a.data as { snapshot: { approved_step_ids?: string[] } }[]).some((r) => r.snapshot.approved_step_ids?.includes(stepId));
}

async function currentStatus(runId: string): Promise<RunStatus | null> {
  const r = await getDb().from('workflow_runs').select('status').eq('id', runId).maybeSingle();
  return (r.data?.status as RunStatus | undefined) ?? null;
}

/**
 * Runs the approved steps in order. Stops at the first failure or at a step that is `waiting`.
 * Safe to call again: finished steps are skipped and every action is idempotent.
 */
export async function executeRun(runId: string): Promise<Result<{ status: RunStatus }>> {
  const db = getDb();
  const first = await currentStatus(runId);
  if (!first) return err('not_found', 'Workflow not found.');
  if (['paused', 'cancelled', 'completed'].includes(first)) return err('not_runnable', `This workflow is ${first === 'paused' ? 'paused' : first}.`);

  const run = await db.from('workflow_runs').select('job_id').eq('id', runId).single();
  const jobId = (run.data?.job_id as string | null) ?? null;

  if (first !== 'executing') {
    const moved = await setRunStatus(runId, 'executing', { error: null });
    if (!moved.ok) return moved;
  }

  const steps = await db.from('workflow_steps').select('id, position, action, title, params, requires_approval, status').eq('run_id', runId).order('position');
  if (steps.error) return err('db_error', "Couldn't load the steps.", steps.error.message);

  let waiting = false;
  for (const step of steps.data as unknown as StepRow[]) {
    if (['completed', 'skipped', 'cancelled'].includes(step.status)) continue;
    if (step.status === 'waiting') { waiting = true; break; }

    // Re-read before every step so a pause or cancel takes effect between steps.
    const live = await currentStatus(runId);
    if (live === 'paused' || live === 'cancelled') return ok({ status: live });

    const ctx = { runId, stepId: step.id, jobId };
    const action = ACTIONS[step.action as keyof typeof ACTIONS];
    if (!action) break; // steps this prompt does not run yet (scoring, follow-ups) sit after a waiting step

    if (action.requiresApproval && !(await isApproved(runId, step.id))) {
      await failStep(ctx, `"${step.title}" needs your approval first.`);
      await setRunStatus(runId, 'failed', { error: 'A step ran without approval.' });
      return err('not_approved', `"${step.title}" needs your approval first.`);
    }

    const started = await startStep(ctx, ['planned', 'queued', 'failed']);
    if (!started.ok) {
      if (started.error.code === 'step_not_startable') continue; // another request is already on it
      return started;
    }

    const out = await action.execute(ctx, step.params);
    if (!out.ok) {
      await failStep(ctx, out.error.message, { code: out.error.code });
      await setRunStatus(runId, 'failed', { error: out.error.message });
      await logEvent({ runId, jobId, type: 'run.failed', actor: 'agent', level: 'error', message: `Stopped: ${out.error.message}` });
      return err(out.error.code, out.error.message);
    }

    const { message, result, status = 'completed', data = {} } = out.data;
    if (status === 'skipped') await skipStep(ctx, message, result, data);
    else await completeStep(ctx, message, result, status, data);
    if (status === 'waiting') { waiting = true; break; }
  }

  const left = await db.from('workflow_steps').select('status').eq('run_id', runId);
  const statuses = (left.data ?? []).map((s) => s.status as StepStatus);
  const allDone = statuses.every((s) => ['completed', 'skipped', 'cancelled'].includes(s));

  const settled = await currentStatus(runId);
  if (settled === 'paused' || settled === 'cancelled') return ok({ status: settled });

  const next: RunStatus = allDone ? 'completed' : waiting ? 'waiting' : 'executing';
  if (next === 'completed') {
    const done = await setRunStatus(runId, 'completed', { completed_at: new Date().toISOString() });
    if (done.ok) await logEvent({ runId, jobId, type: 'run.completed', actor: 'agent', level: 'success', message: 'Workflow finished' });
  } else if (next === 'waiting') {
    await setRunStatus(runId, 'waiting');
  }
  return ok({ status: next });
}
