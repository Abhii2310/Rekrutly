import { z } from 'zod';
import { apiError, apiOk } from '@/lib/api';
import { getAssessmentResults } from '@/lib/db/queries/results';
import { requireRecruiter } from '@/lib/security/require-recruiter';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = await requireRecruiter();
  if (denied) return denied;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return apiError('not_found', 'Assessment not found.', 404);
  const res = await getAssessmentResults(id);
  if (!res.ok) return apiError(res.error.code, res.error.message, 500);
  if (!res.data) return apiError('not_found', 'Assessment not found.', 404);
  return apiOk(res.data);
}
