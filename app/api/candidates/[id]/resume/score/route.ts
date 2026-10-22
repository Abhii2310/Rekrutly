import 'server-only';
import { z } from 'zod';
import { apiError, apiOk, withErrors } from '@/lib/api';
import { scoreCandidateResume } from '@/lib/ats/service';
import { requireRecruiter } from '@/lib/security/require-recruiter';

export const maxDuration = 60;

/** Scores the saved resume against the role. The score is a suggestion; nothing happens to the candidate. */
async function handlePOST(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = await requireRecruiter();
  if (denied) return denied;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return apiError('not_found', 'Candidate not found.', 404);
  const res = await scoreCandidateResume(id);
  if (!res.ok) return apiError(res.error.code, res.error.message, res.error.code === 'not_found' ? 404 : res.error.code === 'db_error' ? 500 : 409);
  return apiOk(res.data);
}

export const POST = withErrors(handlePOST);
