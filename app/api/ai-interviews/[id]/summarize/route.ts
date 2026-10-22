import 'server-only';
import { z } from 'zod';
import { apiError, apiOk, withErrors } from '@/lib/api';
import { summarize } from '@/lib/ai-interview/service';
import { requireRecruiter } from '@/lib/security/require-recruiter';

export const maxDuration = 60;

/** Writes the evidence notes again, for example when the AI was busy the first time. */
async function handlePOST(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = await requireRecruiter();
  if (denied) return denied;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return apiError('not_found', 'Interview not found.', 404);
  const res = await summarize(id);
  if (!res.ok) return apiError(res.error.code, res.error.message, res.error.code === 'not_found' ? 404 : 500);
  return apiOk(res.data);
}

export const POST = withErrors(handlePOST);
