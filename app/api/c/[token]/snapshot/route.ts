import { apiError, apiOk, withErrors } from '@/lib/api';
import { withInvitation } from '@/lib/portal/http';
import { canWriteAnswers } from '@/lib/portal/state';
import { MAX_SNAPSHOT_BYTES, saveSnapshot } from '@/lib/proctor/service';

/** The latest small picture, for the recruiter's live thumbnail. Replaced each time; not kept as a history. */
async function handlePOST(request: Request, { params }: { params: Promise<{ token: string }> }): Promise<Response> {
  const { token } = await params;
  const found = await withInvitation(token);
  if ('response' in found) return found.response;
  const { inv } = found;
  if (!inv.assessment.proctored || !inv.proctor_consent_at) return apiError('not_proctored', 'Recording is not part of this assessment.', 409);
  if (!canWriteAnswers(inv, new Date())) return apiError('closed', 'This assessment is closed.', 409);
  const body = await request.arrayBuffer();
  if (body.byteLength === 0 || body.byteLength > MAX_SNAPSHOT_BYTES) return apiError('invalid_input', 'The picture is empty or too large.', 413);
  const saved = await saveSnapshot(inv.id, body);
  if (!saved.ok) return apiError(saved.error.code, saved.error.message, 500);
  return apiOk({ ok: true });
}

export const POST = withErrors(handlePOST);
