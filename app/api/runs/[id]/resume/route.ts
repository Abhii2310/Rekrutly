import 'server-only';
import { after } from 'next/server';
import { z } from 'zod';
import { apiError, apiOk, withErrors } from '@/lib/api';
import { getDb } from '@/lib/db/server';
import { executeRun } from '@/lib/executor/run';
import { setRunStatus } from '@/lib/executor/run-status';
import { logEvent } from '@/lib/events';
import { requireRecruiter } from '@/lib/security/require-recruiter';

export const maxDuration = 60;

async function handlePOST(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = await requireRecruiter();
  if (denied) return denied;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return apiError('not_found', 'Workflow not found.', 404);
  const db = getDb();
  const run = await db.from('workflow_runs').select('job_id').eq('id', id).maybeSingle();
  if (run.error || !run.data) return apiError('not_found', 'Workflow not found.', 404);
  const waiting = await db.from('workflow_steps').select('id').eq('run_id', id).eq('status', 'waiting').limit(1);

  const moved = await setRunStatus(id, waiting.data && waiting.data.length > 0 ? 'waiting' : 'executing');
  if (!moved.ok) return apiError('invalid_state', "This workflow isn't paused.", 409);
  await logEvent({ runId: id, jobId: run.data.job_id as string | null, type: 'run.resumed', actor: 'recruiter', message: 'Resumed the workflow' });
  after(async () => {
    const result = await executeRun(id);
    if (!result.ok) console.error('executeRun failed after resume:', result.error.code);
  });
  return apiOk({ runId: id, status: moved.data });
}

export const POST = withErrors(handlePOST);
