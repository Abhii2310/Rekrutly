import 'server-only';
import { getDb } from '@/lib/db/server';
import { env } from '@/lib/env';
import { logEvent } from '@/lib/events';
import { err, ok, type Result } from '@/lib/result';
import { loadPipeline } from './load';
import { keysToCreate, keysToResolve, selectTasks } from './rules';

const THROTTLE_MS = 30_000;
const lastSync = new Map<string, number>();

/**
 * Applies the four task rules to a run. Idempotent: tasks are upserted by `dedupe_key`, a task a person finished is not
 * recreated, and open tasks whose condition is gone are closed with "Resolved automatically".
 * Throttled to once per 30 seconds per run unless `force` is set. Never sends anything.
 */
export async function syncTasks(runId: string, options: { force?: boolean } = {}): Promise<Result<{ created: number; resolved: number; skipped: boolean }>> {
  const nowMs = Date.now();
  if (!options.force && nowMs - (lastSync.get(runId) ?? 0) < THROTTLE_MS) return ok({ created: 0, resolved: 0, skipped: true });
  lastSync.set(runId, nowMs);

  const pipe = await loadPipeline(runId);
  if (!pipe.ok) return pipe;
  if (!pipe.data) return err('not_found', 'Workflow not found.');
  const { run, invitations, interviewCandidates } = pipe.data;

  const wanted = selectTasks({ now: new Date(nowMs), overdueMinutes: env.TASK_OVERDUE_MINUTES, invitations, interviewCandidates });
  const db = getDb();
  const existing = await db.from('tasks').select('id, dedupe_key, title, status').eq('run_id', runId).not('dedupe_key', 'is', null);
  if (existing.error) return err('db_error', "Couldn't load the tasks.", existing.error.message);
  const rows = existing.data as { id: string; dedupe_key: string; title: string; status: string }[];

  const toCreate = keysToCreate(rows.map((r) => r.dedupe_key), wanted);
  if (toCreate.length > 0) {
    const ins = await db.from('tasks').upsert(
      toCreate.map((t) => ({ run_id: runId, job_id: run.jobId, candidate_id: t.candidateId, type: t.type, title: t.title, detail: t.detail, dedupe_key: t.dedupeKey })),
      { onConflict: 'dedupe_key', ignoreDuplicates: true },
    );
    if (ins.error) return err('db_error', "Couldn't save the tasks.", ins.error.message);
  }

  const open = rows.filter((r) => r.status === 'open');
  const resolveKeys = new Set(keysToResolve(open.map((r) => r.dedupe_key), wanted));
  const resolving = open.filter((r) => resolveKeys.has(r.dedupe_key));
  if (resolving.length > 0) {
    const now = new Date().toISOString();
    const upd = await db.from('tasks').update({ status: 'done', completed_at: now, detail: 'Resolved automatically' })
      .in('id', resolving.map((r) => r.id)).eq('status', 'open');
    if (upd.error) return err('db_error', "Couldn't close the tasks.", upd.error.message);
    await Promise.all(resolving.map((r) => logEvent({
      runId, jobId: run.jobId, type: 'task.completed', actor: 'system', message: `Resolved automatically: ${r.title}`, data: { taskId: r.id },
    })));
  }
  return ok({ created: toCreate.length, resolved: resolving.length, skipped: false });
}
