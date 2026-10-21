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
  const run = await getDb().from('workflow_runs').select('job_id').eq('id', id).maybeSingle();
  if (run.error || !run.data) return apiError('not_found', 'Workflow not found.', 404);

  const moved = await setRunStatus(id, 'paused');
  if (!moved.ok) return apiError('invalid_state', "This workflow can't be paused right now.", 409);
  await logEvent({ runId: id, jobId: run.data.job_id as string | null, type: 'run.paused', actor: 'recruiter', level: 'warning', message: "Paused. Rekrutly won't take any new actions until you resume." });
  return apiOk({ runId: id, status: 'paused' });
}

export const POST = withErrors(handlePOST);
