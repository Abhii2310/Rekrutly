import 'server-only';
import { z } from 'zod';
import { apiError, apiOk, withErrors } from '@/lib/api';
import { getDb } from '@/lib/db/server';
import { setRunStatus } from '@/lib/executor/run-status';
import { logEvent } from '@/lib/events';
import { requireRecruiter } from '@/lib/security/require-recruiter';

async function handlePOST(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = await requireRecruiter();
  if (denied) return denied;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return apiError('not_found', 'Workflow not found.', 404);

  const db = getDb();
  const run = await db.from('workflow_runs').select('id, job_id, status').eq('id', id).maybeSingle();
  if (run.error || !run.data) return apiError('not_found', 'Workflow not found.', 404);

  // Cancelling twice is a no-op, so the receipts and approvals are not duplicated.
  if (run.data.status === 'cancelled') return apiOk({ runId: id, status: 'cancelled' });

  const moved = await setRunStatus(id, 'cancelled');
  if (!moved.ok) return apiError('invalid_state', "This workflow can't be cancelled any more.", 409);
  await db.from('workflow_steps').update({ status: 'cancelled' }).eq('run_id', id).in('status', ['planned', 'awaiting_approval', 'queued']);
  await db.from('approvals').insert({ run_id: id, decision: 'cancelled', decided_by: 'recruiter', snapshot: { cancelled_from: run.data.status } });
  await logEvent({ runId: id, jobId: run.data.job_id as string | null, type: 'approval.cancelled', actor: 'recruiter', message: 'Cancelled the workflow' });
  return apiOk({ runId: id, status: 'cancelled' });
}

export const POST = withErrors(handlePOST);
