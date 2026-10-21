import { after } from 'next/server';
import { z } from 'zod';
import { apiError, apiOk } from '@/lib/api';
import { getRunLive } from '@/lib/db/queries/live';
import { requireRecruiter } from '@/lib/security/require-recruiter';
import { syncTasks } from '@/lib/tasks/sync';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = await requireRecruiter();
  if (denied) return denied;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return apiError('not_found', 'Workflow not found.', 404);
  const live = await getRunLive(id);
  if (!live.ok) return apiError(live.error.code, live.error.message, 500);
  if (!live.data) return apiError('not_found', 'Workflow not found.', 404);
  // Tasks are kept up to date after the response (at most every 30s per run), so no database work or model call delays a poll.
  if (live.data.assessment) after(async () => { await syncTasks(id); });
  return apiOk(live.data);
}
