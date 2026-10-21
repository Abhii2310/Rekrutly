import 'server-only';
import { getDb } from '@/lib/db/server';
import { logEvent } from '@/lib/events';

/**
 * Keeps the run's "track submissions" step in step with reality: its result says how many have submitted,
 * and it completes once every invitation is submitted or expired.
 */
export async function updateTrackStep(assessmentId: string, runId: string | null, jobId: string | null): Promise<void> {
  if (!runId) return;
  const db = getDb();
  // The invitation list and the step do not depend on each other.
  const [inv, step] = await Promise.all([
    db.from('invitations').select('status').eq('assessment_id', assessmentId),
    db.from('workflow_steps').select('id, status').eq('run_id', runId).eq('action', 'track_submissions').maybeSingle(),
  ]);
  if (inv.error || !inv.data || !step.data || !['waiting', 'completed'].includes(step.data.status as string)) return;
  const total = inv.data.length;
  const submitted = inv.data.filter((r) => r.status === 'submitted').length;
  const expired = inv.data.filter((r) => r.status === 'expired').length;
  const done = total > 0 && submitted + expired === total;

  const message = done ? `All ${total} candidates have finished` : `${submitted} of ${total} candidates have submitted`;
  const completing = done && step.data.status === 'waiting';
  await Promise.all([
    db.from('workflow_steps')
      .update({ result: { message, total, submitted }, ...(completing ? { status: 'completed', finished_at: new Date().toISOString() } : {}) })
      .eq('id', step.data.id as string),
    completing
      ? logEvent({ runId, stepId: step.data.id as string, jobId, type: 'step.completed', actor: 'agent', level: 'success', message })
      : Promise.resolve(),
  ]);
}
