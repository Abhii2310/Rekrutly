import 'server-only';
import { z } from 'zod';
import { apiError, apiOk, withErrors } from '@/lib/api';
import { getDb } from '@/lib/db/server';
import { logEvent } from '@/lib/events';
import { requireRecruiter } from '@/lib/security/require-recruiter';
import { assertTransition, type TaskStatus } from '@/lib/status';

export const dynamic = 'force-dynamic';

const Body = z.object({ status: z.enum(['done', 'dismissed'], { error: 'Choose done or dismissed.' }) });

async function handlePATCH(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = await requireRecruiter();
  if (denied) return denied;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return apiError('not_found', 'Task not found.', 404);
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError('invalid_input', parsed.error.issues[0]?.message ?? 'Choose done or dismissed.', 400);
  const { status } = parsed.data;

  const db = getDb();
  const task = await db.from('tasks').select('id, run_id, job_id, candidate_id, title, status').eq('id', id).maybeSingle();
  if (task.error) return apiError('db_error', "Couldn't load the task.", 500);
  if (!task.data) return apiError('not_found', 'Task not found.', 404);
  const t = assertTransition('task', task.data.status as TaskStatus, status);
  if (!t.ok) return apiError('already_closed', 'This task is already closed.', 409);

  // Only an open task can be closed, so two clicks cannot both log a receipt.
  const upd = await db.from('tasks').update({ status, completed_at: new Date().toISOString() }).eq('id', id).eq('status', 'open').select('id');
  if (upd.error) return apiError('db_error', "Couldn't update the task.", 500);
  if (!upd.data || upd.data.length === 0) return apiError('already_closed', 'This task is already closed.', 409);

  await logEvent({
    runId: task.data.run_id as string | null, jobId: task.data.job_id as string | null, candidateId: task.data.candidate_id as string | null,
    type: status === 'done' ? 'task.completed' : 'task.dismissed', actor: 'recruiter',
    message: `${status === 'done' ? 'Marked done' : 'Dismissed'}: ${task.data.title as string}`, data: { taskId: id },
  });
  return apiOk({ id, status });
}

export const PATCH = withErrors(handlePATCH);
