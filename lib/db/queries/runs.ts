import 'server-only';
import { getDb } from '@/lib/db/server';
import { err, ok, type Result } from '@/lib/result';
import type { WorkflowRunRow, WorkflowStepRow } from '@/lib/db/types';
import type { ResolvedPlan } from '@/lib/ai/resolve-plan';

const RUN_COLUMNS = 'id, instruction, intent, job_id, plan, status, error, is_demo, created_at, updated_at, approved_at, completed_at';
const STEP_COLUMNS = 'id, run_id, position, action, title, params, requires_approval, status, result, error, attempts, started_at, finished_at, created_at, updated_at';

export type RunWithSteps = { run: Omit<WorkflowRunRow, 'plan'> & { plan: ResolvedPlan }; steps: WorkflowStepRow[] };

export async function getRunWithSteps(id: string): Promise<Result<RunWithSteps | null>> {
  const db = getDb();
  const [run, steps] = await Promise.all([
    db.from('workflow_runs').select(RUN_COLUMNS).eq('id', id).maybeSingle(),
    db.from('workflow_steps').select(STEP_COLUMNS).eq('run_id', id).order('position'),
  ]);
  if (run.error) return err('db_error', 'Could not load the workflow.', run.error.message);
  if (steps.error) return err('db_error', 'Could not load the steps.', steps.error.message);
  if (!run.data) return ok(null);
  return ok({ run: run.data as unknown as RunWithSteps['run'], steps: steps.data as unknown as WorkflowStepRow[] });
}
