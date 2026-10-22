import 'server-only';
import { apiError, apiOk, withErrors } from '@/lib/api';
import { checkBounces } from '@/lib/executor/bounces';
import { requireRecruiter } from '@/lib/security/require-recruiter';

export const maxDuration = 25;

/** Looks for bounced invitation emails and marks them failed. Safe to call often; it only reads the inbox. */
async function handlePOST(): Promise<Response> {
  const denied = await requireRecruiter();
  if (denied) return denied;
  const res = await checkBounces();
  if (!res.ok) return apiError(res.error.code, res.error.message, 502);
  return apiOk(res.data);
}

export const POST = withErrors(handlePOST);
