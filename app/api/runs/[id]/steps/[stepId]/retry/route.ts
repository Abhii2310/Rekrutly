import 'server-only';
import { after } from 'next/server';
import { z } from 'zod';
import { apiError, apiOk, withErrors } from '@/lib/api';
import { getDb } from '@/lib/db/server';
import { executeRun } from '@/lib/executor/run';
import { requireRecruiter } from '@/lib/security/require-recruiter';

export const maxDuration = 60;

async function handlePOST(_request: Request, { params }: { params: Promise<{ id: string; stepId: string }> }): Promise<Response> {
  const denied = await requireRecruiter();
  if (denied) return denied;
  const { id, stepId } = await params;
  if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(stepId).success) return apiError('not_found', 'Step not found.', 404);

  const db = getDb();
  const step = await db.from('workflow_steps').select('id, status, action').eq('id', stepId).eq('run_id', id).maybeSingle();
  if (step.error || !step.data) return apiError('not_found', 'Step not found.', 404);
  if (step.data.status !== 'failed') return apiError('invalid_state', 'Only a failed step can be retried.', 409);
  // The run goes failed -> executing inside executeRun (the status map allows exactly that).
  after(async () => {
    const result = await executeRun(id);
    if (!result.ok) console.error('executeRun failed after retry:', result.error.code);
  });
  return apiOk({ runId: id, status: 'executing' });
}

export const POST = withErrors(handlePOST);
