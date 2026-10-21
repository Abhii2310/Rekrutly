import 'server-only';
import { getDb } from '@/lib/db/server';
import { logEvent } from '@/lib/events';
import { err, ok, type Result } from '@/lib/result';
import type { Json } from '@/lib/db/types';

type Starting = { runId: string; stepId: string; jobId: string | null };

/**
 * Moves a step into `executing` only if it is in one of `from`. The conditional update is the guard
 * against two requests starting the same step at once.
 */
export async function startStep(s: Starting, from: string[]): Promise<Result<{ attempts: number }>> {
  const db = getDb();
  const cur = await db.from('workflow_steps').select('attempts, title').eq('id', s.stepId).maybeSingle();
  if (cur.error || !cur.data) return err('db_error', "Couldn't load the step.");
  const attempts = (cur.data.attempts as number) + 1;
  const upd = await db.from('workflow_steps')
    .update({ status: 'executing', attempts, started_at: new Date().toISOString(), finished_at: null, error: null })
    .eq('id', s.stepId).in('status', from).select('id');
  if (upd.error) return err('db_error', "Couldn't start the step.", upd.error.message);
  if (!upd.data || upd.data.length === 0) return err('step_not_startable', 'This step is already running or finished.');
  await logEvent({ runId: s.runId, stepId: s.stepId, jobId: s.jobId, type: 'step.started', actor: 'agent', message: `Started: ${cur.data.title as string}`, data: { attempt: attempts } });
  return ok({ attempts });
}

export async function completeStep(s: Starting, message: string, result: Json, status: 'completed' | 'waiting' = 'completed', data: Json = {}): Promise<void> {
  await getDb().from('workflow_steps')
    .update({ status, result: { message, ...result }, finished_at: status === 'completed' ? new Date().toISOString() : null })
    .eq('id', s.stepId);
  await logEvent({ runId: s.runId, stepId: s.stepId, jobId: s.jobId, type: 'step.completed', actor: 'agent', level: 'success', message, data });
}

export async function failStep(s: Starting, message: string, data: Json = {}): Promise<void> {
  await getDb().from('workflow_steps').update({ status: 'failed', error: message, finished_at: new Date().toISOString() }).eq('id', s.stepId);
  await logEvent({ runId: s.runId, stepId: s.stepId, jobId: s.jobId, type: 'step.failed', actor: 'agent', level: 'error', message, data });
}

/** Marks a step skipped, with the reason as its result. Logged as a normal receipt, not an error. */
export async function skipStep(s: Starting, message: string, result: Json = {}, data: Json = {}): Promise<void> {
  const db = getDb();
  const step = await db.from('workflow_steps').select('title').eq('id', s.stepId).maybeSingle();
  await db.from('workflow_steps')
    .update({ status: 'skipped', result: { message, ...result }, finished_at: new Date().toISOString() })
    .eq('id', s.stepId);
  // The reason is already in the step's own receipt (for example email.unconfigured), so this one just notes the skip.
  await logEvent({ runId: s.runId, stepId: s.stepId, jobId: s.jobId, type: 'step.completed', actor: 'agent', level: 'info', message: `Skipped: ${(step.data?.title as string | undefined) ?? 'a step'}`, data });
}
