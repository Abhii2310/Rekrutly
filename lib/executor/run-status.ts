import 'server-only';
import { getDb } from '@/lib/db/server';
import { err, ok, type Result } from '@/lib/result';
import { assertTransition, type RunStatus } from '@/lib/status';

/**
 * Moves a run to a new status. Checks the transition against lib/status.ts and updates only if the run
 * is still in the status we read, so two requests cannot both move it.
 */
export async function setRunStatus(runId: string, to: RunStatus, patch: Record<string, unknown> = {}): Promise<Result<RunStatus>> {
  const db = getDb();
  const cur = await db.from('workflow_runs').select('status').eq('id', runId).maybeSingle();
  if (cur.error || !cur.data) return err('db_error', "Couldn't load the workflow.");
  const from = cur.data.status as RunStatus;
  if (from === to) return ok(to);
  const t = assertTransition('run', from, to);
  if (!t.ok) return t;
  const upd = await db.from('workflow_runs').update({ status: to, ...patch }).eq('id', runId).eq('status', from).select('id');
  if (upd.error) return err('db_error', "Couldn't update the workflow.", upd.error.message);
  if (!upd.data || upd.data.length === 0) return err('conflict', 'The workflow changed while we were updating it. Reload and try again.');
  return ok(to);
}
