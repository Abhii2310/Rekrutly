import 'server-only';
import { z } from 'zod';
import { getDb } from '@/lib/db/server';
import { err, ok } from '@/lib/result';
import { mapWithConcurrency } from '@/lib/scoring/safe';
import { createDraftForTask } from '@/lib/tasks/draft';
import { findTargetRun, loadPipeline } from '@/lib/tasks/load';
import { computeNextActions } from '@/lib/tasks/next-actions';
import { syncTasks } from '@/lib/tasks/sync';
import { plural } from '@/lib/format-text';
import type { ActionDef } from './actions';

type SweepParams = { targetRunId: string | null; jobId: string | null };
const sweepSchema = z.object({ targetRunId: z.uuid().nullable().default(null), jobId: z.uuid().nullable().default(null) }) as unknown as z.ZodType<SweepParams>;

const MAX_DRAFTS = 5;
const DRAFT_CONCURRENCY = 3;

async function resolveTarget(p: SweepParams): Promise<string | null> {
  if (p.targetRunId) return p.targetRunId;
  const found = await findTargetRun(p.jobId);
  return found.ok ? (found.data?.id ?? null) : null;
}

export const analyzePipeline: ActionDef<SweepParams> = {
  name: 'analyze_pipeline',
  title: () => 'Review the pipeline and find blockers',
  paramsSchema: sweepSchema,
  requiresApproval: true,
  async run(_ctx, p) {
    const target = await resolveTarget(p);
    if (!target) return err('no_target', 'There is no assessment workflow to review yet.');
    const synced = await syncTasks(target, { force: true });
    if (!synced.ok) return synced;
    const pipe = await loadPipeline(target);
    if (!pipe.ok) return pipe;
    if (!pipe.data) return err('not_found', 'The workflow to review was not found.');
    const open = await getDb().from('tasks').select('type').eq('run_id', target).eq('status', 'open');
    if (open.error) return err('db_error', "Couldn't load the tasks.", open.error.message);
    const types = (open.data as { type: string }[]).map((t) => t.type);
    const followUps = types.filter((t) => t === 'follow_up').length;
    const nextActions = computeNextActions(pipe.data.invitations, followUps);
    return ok({
      message: `Reviewed ${plural(pipe.data.invitations.length, 'candidate')}: ${plural(followUps, 'follow-up')}, ${plural(types.length - followUps, 'other task')}`,
      result: { targetRunId: target, followUps, openTasks: types.length, nextActions },
    });
  },
};

export const draftFollowups: ActionDef<SweepParams> = {
  name: 'draft_followups',
  title: () => 'Draft follow-up messages',
  paramsSchema: sweepSchema,
  requiresApproval: true,
  async run(_ctx, p) {
    const target = await resolveTarget(p);
    if (!target) return err('no_target', 'There is no assessment workflow to draft for.');
    const tasks = await getDb().from('tasks').select('id, draft').eq('run_id', target).eq('type', 'follow_up').eq('status', 'open').order('created_at').limit(MAX_DRAFTS);
    if (tasks.error) return err('db_error', "Couldn't load the follow-ups.", tasks.error.message);
    const rows = tasks.data as { id: string; draft: unknown }[];
    const todo = rows.filter((t) => !t.draft);
    if (rows.length === 0) return ok({ message: 'No follow-ups are needed right now', result: { drafted: 0, failed: 0, targetRunId: target } });

    // English drafts, three at a time. A message that already has a draft is left as it is.
    const results = await mapWithConcurrency(todo, DRAFT_CONCURRENCY, (t) => createDraftForTask(t.id, 'en'));
    const drafted = results.filter((r) => r.ok).length;
    const failed = results.length - drafted;
    if (todo.length > 0 && drafted === 0) return err('draft_failed', "Couldn't write the messages. Retry in a moment.");
    const kept = rows.length - todo.length;
    return ok({
      message: `Drafted ${plural(drafted, 'message')}${kept > 0 ? `, ${kept} already drafted` : ''}${failed > 0 ? `, ${failed} failed` : ''}. Nothing was sent`,
      result: { drafted, failed, kept, targetRunId: target },
    });
  },
};
