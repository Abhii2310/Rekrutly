import { z } from 'zod';
import { apiError, apiOk } from '@/lib/api';
import { getRunLive } from '@/lib/db/queries/live';
import { requireRecruiter } from '@/lib/security/require-recruiter';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = await requireRecruiter();
  if (denied) return denied;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return apiError('not_found', 'Workflow not found.', 404);
  const live = await getRunLive(id);
  if (!live.ok) return apiError(live.error.code, live.error.message, 500);
  if (!live.data) return apiError('not_found', 'Workflow not found.', 404);
  return apiOk(live.data);
}
